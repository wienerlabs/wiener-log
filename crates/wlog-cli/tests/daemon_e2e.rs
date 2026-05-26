//! Daemon end-to-end integration test.
//!
//! Drives the full chain: spawn a NATS container, run the daemon
//! pointed at it, write a `HookPayload` to the daemon's socket, and
//! assert that the matching NATS subject receives the message.
//!
//! Gated behind `#[ignore]` because it needs Docker locally; CI runs
//! it via `cargo nextest run --run-ignored ignored-only` against the
//! workflow's nats service when `WLOG_TEST_NATS_URL` is set.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use futures::StreamExt;
use testcontainers::core::{IntoContainerPort, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{GenericImage, ImageExt};
use tokio::sync::Notify;
use tokio::time::{sleep, timeout};
use wlog_cli::daemon::{DaemonConfig, run};
use wlog_ingest_git::{HookPayload, write_payload};

async fn pool_for_test() -> Result<(String, Option<testcontainers::ContainerAsync<GenericImage>>)> {
    if let Ok(url) = std::env::var("WLOG_TEST_NATS_URL") {
        return Ok((url, None));
    }
    let container = GenericImage::new("nats", "2.10-alpine")
        .with_exposed_port(4222.tcp())
        .with_wait_for(WaitFor::message_on_stderr("Server is ready"))
        .with_cmd(["-js".to_string()])
        .start()
        .await?;
    let port = container.get_host_port_ipv4(4222).await?;
    let url = format!("nats://127.0.0.1:{port}");
    Ok((url, Some(container)))
}

#[tokio::test]
#[ignore = "needs docker or WLOG_TEST_NATS_URL"]
async fn daemon_publishes_hook_payloads_to_nats() -> Result<()> {
    let (nats_url, _guard) = pool_for_test().await?;

    let tmp = tempdir::TempDir::new("wlog-daemon-e2e")?;
    let socket = tmp.path().join("wlog.sock");
    let config = DaemonConfig {
        socket: socket.clone(),
        nats_url: Some(nats_url.clone()),
        cc_projects_dir: None,
        cc_cursor_path: None,
    };
    let shutdown = Arc::new(Notify::new());

    let daemon_shutdown = Arc::clone(&shutdown);
    let daemon_task = tokio::spawn(async move { run(config, daemon_shutdown).await });

    // Wait for the socket to appear, capped at 2 seconds.
    let mut tries = 0;
    while !socket.exists() {
        if tries > 40 {
            anyhow::bail!("daemon never created socket");
        }
        sleep(Duration::from_millis(50)).await;
        tries += 1;
    }

    // Subscribe before we publish so we definitely catch the message.
    let subscriber = async_nats::connect(&nats_url).await?;
    let mut sub = subscriber
        .subscribe("wlog.local.event.git.>".to_string())
        .await?;

    // Hook -> socket. Run the sync writer in a blocking task so it
    // does not block the runtime.
    let socket_for_write = socket.clone();
    let payload = HookPayload {
        kind: "post-commit".to_string(),
        cwd: "/tmp/e2e".to_string(),
        args: vec!["a".into(), "b".into()],
        repo_remote: Some("git@github.com:wienerlabs/test.git".into()),
        head_sha: Some("c0ffeec0ffee".into()),
        branch: Some("main".into()),
        emitted_at: chrono::Utc::now(),
    };
    let payload_for_write = payload.clone();
    tokio::task::spawn_blocking(move || write_payload(&socket_for_write, &payload_for_write))
        .await??;

    // Wait for the matching NATS message with a 3-second budget.
    let received = timeout(Duration::from_secs(3), sub.next())
        .await?
        .expect("subscription closed early");
    assert_eq!(
        received.subject.as_str(),
        "wlog.local.event.git.post-commit"
    );
    let body: HookPayload = serde_json::from_slice(&received.payload)?;
    assert_eq!(body, payload);

    // Tear down.
    shutdown.notify_waiters();
    let stats = timeout(Duration::from_secs(5), daemon_task).await???;
    assert_eq!(stats.socket_payloads, 1);
    assert_eq!(stats.cc_events, 0);

    Ok(())
}
