//! CC probe end-to-end integration test.
//!
//! Spins a fresh NATS container, drops a synthetic Claude Code session
//! JSONL into a tempdir, runs the daemon with the CC worker pointed at
//! the tempdir, and asserts the matching `wlog.local.event.cc.*`
//! messages land on NATS.

use std::fs;
use std::io::Write;
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

#[tokio::test]
#[ignore = "needs docker or WLOG_TEST_NATS_URL"]
async fn daemon_cc_worker_publishes_session_events() -> Result<()> {
    let (nats_url, _guard) = nats_for_test().await?;

    let tmp = tempdir::TempDir::new("wlog-cc-e2e")?;
    let socket = tmp.path().join("wlog.sock");
    let cursor = tmp.path().join("cc-cursor.json");
    let projects = tmp.path().join("projects");
    fs::create_dir_all(&projects)?;

    // Subscribe first so we never miss a publish, then start the daemon,
    // then drop the synthetic session into place. The CC worker's
    // 5-second poll catches it on the next tick.
    let subscriber = async_nats::connect(&nats_url).await?;
    let mut sub = subscriber
        .subscribe("wlog.local.event.cc.>".to_string())
        .await?;

    let config = DaemonConfig {
        database_url: None,
        socket: socket.clone(),
        nats_url: Some(nats_url.clone()),
        cc_projects_dir: Some(projects.clone()),
        cc_cursor_path: Some(cursor.clone()),
        gh_listen: None,
        gh_secret: None,
    };
    let shutdown = Arc::new(Notify::new());
    let daemon_shutdown = Arc::clone(&shutdown);
    let daemon_task = tokio::spawn(async move { run(config, daemon_shutdown).await });

    // Wait for the daemon's socket to appear so we know workers are alive.
    let mut tries = 0;
    while !socket.exists() {
        if tries > 40 {
            anyhow::bail!("daemon never created socket");
        }
        sleep(Duration::from_millis(50)).await;
        tries += 1;
    }

    let session_dir = projects.join("demo-project");
    fs::create_dir_all(&session_dir)?;
    let session_path = session_dir.join("session-fixture.jsonl");
    {
        let mut f = fs::File::create(&session_path)?;
        writeln!(
            f,
            r#"{{"type":"user","timestamp":"2026-05-26T20:00:00Z","message":{{"role":"user","content":"first ping"}}}}"#
        )?;
        writeln!(
            f,
            r#"{{"type":"assistant","timestamp":"2026-05-26T20:00:01Z","message":{{"role":"assistant","content":[{{"type":"text","text":"first pong"}}]}}}}"#
        )?;
    }

    // The CC worker fires the first tick immediately, but the empty
    // projects dir produced no events. The next tick is one
    // CC_POLL_INTERVAL away. Wait up to 12 seconds to comfortably
    // include either tick window.
    let mut subjects = Vec::new();
    let collect = async {
        while subjects.len() < 3 {
            if let Some(msg) = sub.next().await {
                subjects.push(msg.subject.as_str().to_string());
            } else {
                break;
            }
        }
    };
    timeout(Duration::from_secs(12), collect).await?;

    // Append a new line and confirm the next scan picks it up.
    {
        let mut f = fs::OpenOptions::new().append(true).open(&session_path)?;
        writeln!(
            f,
            r#"{{"type":"user","timestamp":"2026-05-26T20:00:02Z","message":{{"role":"user","content":"second ping"}}}}"#
        )?;
    }
    let mut more = Vec::new();
    let collect_more = async {
        while more.is_empty() {
            if let Some(msg) = sub.next().await {
                more.push(msg.subject.as_str().to_string());
            } else {
                break;
            }
        }
    };
    timeout(Duration::from_secs(12), collect_more).await?;

    shutdown.notify_waiters();
    let stats = timeout(Duration::from_secs(5), daemon_task).await???;
    assert!(
        stats.cc_events >= 4,
        "expected >=4 cc events, got {}",
        stats.cc_events
    );
    assert!(
        subjects
            .iter()
            .any(|s| s == "wlog.local.event.cc.session_started"),
        "subjects: {subjects:?}"
    );
    assert!(
        subjects
            .iter()
            .filter(|s| *s == "wlog.local.event.cc.session_message")
            .count()
            >= 2,
        "subjects: {subjects:?}"
    );
    assert!(
        more.iter()
            .any(|s| s == "wlog.local.event.cc.session_message"),
        "expected appended line, got: {more:?}"
    );

    Ok(())
}
