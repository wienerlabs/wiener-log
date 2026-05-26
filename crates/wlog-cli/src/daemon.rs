//! `wlog daemon` long-running coordinator.
//!
//! Owns the Unix socket that hook scripts write to and (in Phase 1 #27)
//! the NATS publisher that forwards enriched payloads upstream.
//! Currently ships the listener and a logging sink; the NATS leg lands
//! in the same crate but a separate module.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::Notify;
use tokio::task::JoinSet;

use wlog_ingest_git::HookPayload;

/// Configuration assembled from CLI args and environment.
#[derive(Debug, Clone)]
pub struct DaemonConfig {
    /// Path to bind the Unix socket at.
    pub socket: PathBuf,
    /// Optional NATS URL; `None` skips publishing (Phase 1 #27 lands the
    /// real wiring; this Phase 1 #26 daemon ships only the listener so
    /// tests can verify the wire path independently).
    pub nats_url: Option<String>,
}

/// Run the daemon until `shutdown` fires. Returns the number of
/// payloads accepted in the listener's lifetime.
pub async fn run(config: DaemonConfig, shutdown: Arc<Notify>) -> Result<u64> {
    let listener = bind_listener(&config.socket)?;
    tracing::info!(socket = %config.socket.display(), "wlog daemon listening");

    let sink: Arc<dyn PayloadSink> = match config.nats_url {
        Some(url) => Arc::new(NatsSink::connect(&url).await?),
        None => Arc::new(LoggingSink::default()),
    };

    let counter = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let mut tasks: JoinSet<()> = JoinSet::new();

    loop {
        tokio::select! {
            biased;
            () = shutdown.notified() => {
                tracing::info!("shutdown signal received");
                break;
            }
            accept = listener.accept() => {
                let (stream, _addr) = match accept {
                    Ok(pair) => pair,
                    Err(e) => {
                        tracing::warn!(error = %e, "accept failed; retrying");
                        continue;
                    }
                };
                let sink = Arc::clone(&sink);
                let counter = Arc::clone(&counter);
                tasks.spawn(async move {
                    if let Err(e) = handle_connection(stream, sink, counter).await {
                        tracing::warn!(error = %e, "connection handler failed");
                    }
                });
            }
        }
    }

    // Drain in-flight tasks so no payload is dropped on shutdown.
    while tasks.join_next().await.is_some() {}
    let _ = std::fs::remove_file(&config.socket);
    Ok(counter.load(std::sync::atomic::Ordering::SeqCst))
}

fn bind_listener(socket: &std::path::Path) -> Result<UnixListener> {
    if let Some(parent) = socket.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    if socket.exists() {
        std::fs::remove_file(socket)
            .with_context(|| format!("removing stale socket at {}", socket.display()))?;
    }
    UnixListener::bind(socket).with_context(|| format!("binding {}", socket.display()))
}

async fn handle_connection(
    stream: tokio::net::UnixStream,
    sink: Arc<dyn PayloadSink>,
    counter: Arc<std::sync::atomic::AtomicU64>,
) -> Result<()> {
    let mut lines = BufReader::new(stream).lines();
    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let payload: HookPayload = match serde_json::from_str(trimmed) {
            Ok(p) => p,
            Err(e) => {
                tracing::warn!(error = %e, raw = %trimmed, "invalid payload");
                continue;
            }
        };
        if let Err(e) = sink.accept(payload).await {
            tracing::warn!(error = %e, "sink rejected payload");
            continue;
        }
        counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
    Ok(())
}

/// Anything that can absorb a [`HookPayload`].
#[async_trait::async_trait]
pub trait PayloadSink: Send + Sync {
    /// Absorb a single payload. Implementations may persist, publish, or
    /// log; errors are surfaced by the daemon but do not stop the loop.
    async fn accept(&self, payload: HookPayload) -> Result<()>;
}

/// Logging sink used when no NATS URL is configured. Useful in tests
/// and `wlog daemon run --no-nats`.
#[derive(Debug, Default)]
pub struct LoggingSink {
    events: tokio::sync::Mutex<Vec<HookPayload>>,
}

impl LoggingSink {
    /// Borrow the accumulated payloads (test helper, used by the
    /// integration test under `crates/wlog-cli/tests/`).
    #[allow(dead_code, reason = "consumed by integration tests only")]
    pub async fn snapshot(&self) -> Vec<HookPayload> {
        self.events.lock().await.clone()
    }
}

#[async_trait::async_trait]
impl PayloadSink for LoggingSink {
    async fn accept(&self, payload: HookPayload) -> Result<()> {
        tracing::info!(kind = %payload.kind, cwd = %payload.cwd, "payload received");
        self.events.lock().await.push(payload);
        Ok(())
    }
}

/// NATS sink. Connects once on construction; per-message publish uses
/// the subject ADR-0007 documents: `wlog.{workspace}.event.git.{kind}`.
/// Workspace defaulting deferred to #32; for now everything publishes
/// to `wlog.local.event.git.{kind}` so the wire path is testable.
pub struct NatsSink {
    client: async_nats::Client,
    workspace: String,
}

impl std::fmt::Debug for NatsSink {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // `client` is intentionally excluded; its Debug is verbose and
        // not useful in logs. `finish_non_exhaustive` keeps clippy happy.
        f.debug_struct("NatsSink")
            .field("workspace", &self.workspace)
            .finish_non_exhaustive()
    }
}

impl NatsSink {
    /// Connect to the given NATS URL.
    pub async fn connect(url: &str) -> Result<Self> {
        let client = async_nats::connect(url)
            .await
            .with_context(|| format!("connecting to NATS at {url}"))?;
        let workspace =
            std::env::var("WLOG_DAEMON_WORKSPACE").unwrap_or_else(|_| "local".to_string());
        Ok(Self { client, workspace })
    }
}

#[async_trait::async_trait]
impl PayloadSink for NatsSink {
    async fn accept(&self, payload: HookPayload) -> Result<()> {
        let subject = format!("wlog.{}.event.git.{}", self.workspace, payload.kind);
        let body = serde_json::to_vec(&payload)?;
        self.client
            .publish(subject.clone(), body.into())
            .await
            .with_context(|| format!("publish to {subject}"))?;
        self.client
            .flush()
            .await
            .with_context(|| format!("flush after {subject}"))?;
        tracing::debug!(%subject, kind = %payload.kind, "published");
        Ok(())
    }
}
