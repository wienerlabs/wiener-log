//! GH webhook end-to-end test.
//!
//! Spins NATS via testcontainers, starts the daemon with a webhook
//! listener bound to a random port, POSTs an HMAC-signed payload, and
//! asserts the matching `wlog.local.event.gh.*` subject lands on NATS.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use futures::StreamExt;
use testcontainers::core::{IntoContainerPort, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{GenericImage, ImageExt};
use tokio::net::TcpListener;
use tokio::sync::Notify;
use tokio::time::{sleep, timeout};
use wlog_cli::daemon::{DaemonConfig, run};
use wlog_ingest_gh::hmac::sign;

async fn nats_for_test() -> Result<(String, Option<testcontainers::ContainerAsync<GenericImage>>)> {
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
    Ok((format!("nats://127.0.0.1:{port}"), Some(container)))
}

async fn free_port() -> Result<u16> {
    // Bind to port 0, capture the assigned port, drop the listener so
    // the daemon can rebind. There is a small race here but it has
    // never tripped in practice.
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

#[tokio::test]
#[ignore = "needs docker or WLOG_TEST_NATS_URL"]
async fn daemon_gh_worker_publishes_pr_event() -> Result<()> {
    let (nats_url, _guard) = nats_for_test().await?;

    let secret = "webhook-shh".to_string();
    let port = free_port().await?;
    let listen = format!("127.0.0.1:{port}");
    let tmp = tempdir::TempDir::new("wlog-gh-e2e")?;
    let socket = tmp.path().join("wlog.sock");

    // Subscribe first so we never miss a publish.
    let subscriber = async_nats::connect(&nats_url).await?;
    let mut sub = subscriber
        .subscribe("wlog.local.event.gh.>".to_string())
        .await?;

    let config = DaemonConfig {
        socket: socket.clone(),
        nats_url: Some(nats_url.clone()),
        cc_projects_dir: None,
        cc_cursor_path: None,
        gh_listen: Some(listen.clone()),
        gh_secret: Some(secret.clone()),
    };
    let shutdown = Arc::new(Notify::new());
    let daemon_shutdown = Arc::clone(&shutdown);
    let daemon_task = tokio::spawn(async move { run(config, daemon_shutdown).await });

    // Wait for both the socket and the webhook listener.
    let mut tries = 0;
    loop {
        if socket.exists() && tokio::net::TcpStream::connect(&listen).await.is_ok() {
            break;
        }
        if tries > 60 {
            anyhow::bail!("daemon never reached ready");
        }
        sleep(Duration::from_millis(50)).await;
        tries += 1;
    }

    // POST a signed pull_request.opened payload.
    let body = serde_json::json!({
        "action": "opened",
        "repository": { "full_name": "wienerlabs/test" },
        "sender": { "login": "kh0ra" }
    });
    let body_bytes = serde_json::to_vec(&body)?;
    let signature = sign(secret.as_bytes(), &body_bytes);
    let client = reqwest::Client::new();
    let url = format!("http://{listen}/webhook");
    let resp = client
        .post(&url)
        .header("x-github-event", "pull_request")
        .header("x-github-delivery", "deliv-e2e-1")
        .header("x-hub-signature-256", signature)
        .header("content-type", "application/json")
        .body(body_bytes)
        .send()
        .await?;
    assert!(resp.status().is_success(), "POST failed: {}", resp.status());

    // Wait up to 5 seconds for the NATS message.
    let msg = timeout(Duration::from_secs(5), sub.next())
        .await?
        .expect("subscription closed");
    assert_eq!(msg.subject.as_str(), "wlog.local.event.gh.pr.opened");
    let parsed: wlog_ingest_gh::GhEvent = serde_json::from_slice(&msg.payload)?;
    assert_eq!(parsed.subject_suffix(), "pr.opened");
    assert_eq!(parsed.repository.as_deref(), Some("wienerlabs/test"));

    shutdown.notify_waiters();
    let stats = timeout(Duration::from_secs(5), daemon_task).await???;
    assert_eq!(stats.gh_events, 1);

    Ok(())
}
