//! `wlog daemon` long-running coordinator.
//!
//! Two workers run side by side under one process:
//!
//! 1. **Socket listener** - reads `HookPayload` lines from the Unix
//!    socket written to by git hooks (via `wlog hooks notify`).
//! 2. **CC worker** - polls `~/.claude/projects/` every
//!    [`CC_POLL_INTERVAL`] and republishes new transcript activity as
//!    `event.cc.*` payloads.
//!
//! Both workers share a single [`PayloadSink`] (NATS in production,
//! logging in tests) so the wire layer stays uniform.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::Notify;
use tokio::task::JoinSet;
use tokio::time::interval;

use wlog_ingest_cc::{CcEvent, ScannerCursor};
use wlog_ingest_git::HookPayload;

/// How often the CC worker rescans the projects directory.
pub const CC_POLL_INTERVAL: Duration = Duration::from_secs(5);

/// Configuration assembled from CLI args and environment.
#[derive(Debug, Clone)]
pub struct DaemonConfig {
    /// Path to bind the Unix socket at.
    pub socket: PathBuf,
    /// Optional NATS URL; `None` skips publishing and feeds payloads
    /// into [`LoggingSink`] instead.
    pub nats_url: Option<String>,
    /// Optional `~/.claude/projects/` directory to watch. When `None`,
    /// the CC worker does not start. Tests pass an explicit path.
    pub cc_projects_dir: Option<PathBuf>,
    /// Where to persist the CC cursor. Defaults to
    /// [`ScannerCursor::default_path`].
    pub cc_cursor_path: Option<PathBuf>,
}

/// Counters accumulated across all workers.
#[derive(Debug, Default)]
pub struct DaemonStats {
    /// `HookPayload`s accepted from the socket.
    pub socket_payloads: u64,
    /// CC events forwarded to the sink.
    pub cc_events: u64,
}

/// Run the daemon until `shutdown` fires. Returns aggregated counters
/// for every worker.
pub async fn run(config: DaemonConfig, shutdown: Arc<Notify>) -> Result<DaemonStats> {
    let listener = bind_listener(&config.socket)?;
    tracing::info!(socket = %config.socket.display(), "wlog daemon listening");

    let sink: Arc<dyn PayloadSink> = match config.nats_url {
        Some(ref url) => Arc::new(NatsSink::connect(url).await?),
        None => Arc::new(LoggingSink::default()),
    };

    let socket_counter = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let cc_counter = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let mut tasks: JoinSet<()> = JoinSet::new();

    // Spin up the CC worker if a projects dir was configured.
    if let Some(projects_dir) = config.cc_projects_dir.clone() {
        let sink = Arc::clone(&sink);
        let counter = Arc::clone(&cc_counter);
        let shutdown = Arc::clone(&shutdown);
        let cursor_path = config
            .cc_cursor_path
            .clone()
            .unwrap_or_else(ScannerCursor::default_path);
        tasks.spawn(async move {
            if let Err(e) = run_cc_worker(projects_dir, cursor_path, sink, counter, shutdown).await
            {
                tracing::warn!(error = %e, "cc worker exited with error");
            }
        });
    }

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
                let counter = Arc::clone(&socket_counter);
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
    Ok(DaemonStats {
        socket_payloads: socket_counter.load(std::sync::atomic::Ordering::SeqCst),
        cc_events: cc_counter.load(std::sync::atomic::Ordering::SeqCst),
    })
}

async fn run_cc_worker(
    projects_dir: PathBuf,
    cursor_path: PathBuf,
    sink: Arc<dyn PayloadSink>,
    counter: Arc<std::sync::atomic::AtomicU64>,
    shutdown: Arc<Notify>,
) -> Result<()> {
    let mut cursor = ScannerCursor::load(&cursor_path)
        .with_context(|| format!("loading cc cursor at {}", cursor_path.display()))?;
    let mut ticker = interval(CC_POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    tracing::info!(projects = %projects_dir.display(), "cc worker started");
    loop {
        tokio::select! {
            biased;
            () = shutdown.notified() => {
                tracing::info!("cc worker shutting down");
                let _ = cursor.save(&cursor_path);
                return Ok(());
            }
            _ = ticker.tick() => {
                let dir = projects_dir.clone();
                let mut cursor_clone = cursor.clone();
                let scan_result = tokio::task::spawn_blocking(move || {
                    let events = wlog_ingest_cc::scan(&dir, &mut cursor_clone)?;
                    Ok::<_, std::io::Error>((events, cursor_clone))
                })
                .await
                .map_err(|e| anyhow::anyhow!("cc scan join: {e}"))?;
                let (events, new_cursor) = match scan_result {
                    Ok(pair) => pair,
                    Err(e) => {
                        tracing::warn!(error = %e, "cc scan failed");
                        continue;
                    }
                };
                cursor = new_cursor;
                for event in events {
                    let kind = event.kind();
                    let payload = HookPayload {
                        kind: format!("cc.{kind}"),
                        cwd: projects_dir.display().to_string(),
                        args: vec![event.session_id().to_string()],
                        repo_remote: None,
                        head_sha: None,
                        branch: None,
                        emitted_at: chrono::Utc::now(),
                    };
                    let extras = serde_json::to_value(&event).unwrap_or(serde_json::Value::Null);
                    if let Err(e) = sink.accept_cc(payload, extras).await {
                        tracing::warn!(error = %e, "cc sink rejected event");
                    } else {
                        counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    }
                }
                if let Err(e) = cursor.save(&cursor_path) {
                    tracing::warn!(error = %e, path = %cursor_path.display(), "cursor save failed");
                }
            }
        }
    }
}

#[doc(hidden)]
pub fn build_cc_subject(workspace: &str, event: &CcEvent) -> String {
    format!("wlog.{workspace}.event.cc.{}", event.kind())
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

/// Anything that can absorb the daemon's inbound events. Two channels:
/// git hook payloads and Claude Code session events. Implementations
/// route each channel to the matching ADR-0007 subject prefix.
#[async_trait::async_trait]
pub trait PayloadSink: Send + Sync {
    /// Absorb one git hook payload (`event.git.{kind}`).
    async fn accept(&self, payload: HookPayload) -> Result<()>;

    /// Absorb one CC event (`event.cc.{kind}`). The bridging
    /// [`HookPayload`] carries metadata (cwd, session id in args); the
    /// JSON `extras` is the serialized [`CcEvent`].
    async fn accept_cc(&self, payload: HookPayload, extras: serde_json::Value) -> Result<()>;
}

/// Logging sink used when no NATS URL is configured. Useful in tests
/// and `wlog daemon run --no-nats`.
#[derive(Debug, Default)]
pub struct LoggingSink {
    git: tokio::sync::Mutex<Vec<HookPayload>>,
    cc: tokio::sync::Mutex<Vec<(HookPayload, serde_json::Value)>>,
}

impl LoggingSink {
    /// Borrow the accumulated git payloads (test helper).
    #[allow(dead_code, reason = "consumed by integration tests only")]
    pub async fn git_snapshot(&self) -> Vec<HookPayload> {
        self.git.lock().await.clone()
    }

    /// Borrow the accumulated CC events (test helper).
    #[allow(dead_code, reason = "consumed by integration tests only")]
    pub async fn cc_snapshot(&self) -> Vec<(HookPayload, serde_json::Value)> {
        self.cc.lock().await.clone()
    }
}

#[async_trait::async_trait]
impl PayloadSink for LoggingSink {
    async fn accept(&self, payload: HookPayload) -> Result<()> {
        tracing::info!(kind = %payload.kind, cwd = %payload.cwd, "git payload");
        self.git.lock().await.push(payload);
        Ok(())
    }

    async fn accept_cc(&self, payload: HookPayload, extras: serde_json::Value) -> Result<()> {
        tracing::info!(kind = %payload.kind, "cc event");
        self.cc.lock().await.push((payload, extras));
        Ok(())
    }
}

/// NATS sink. Connects once on construction; per-message publish uses
/// the subject taxonomy ADR-0007 documents:
///
/// - `wlog.{workspace}.event.git.{kind}` for hook payloads
/// - `wlog.{workspace}.event.cc.{kind}` for CC events
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

    async fn publish(&self, subject: String, body: Vec<u8>) -> Result<()> {
        self.client
            .publish(subject.clone(), body.into())
            .await
            .with_context(|| format!("publish to {subject}"))?;
        self.client
            .flush()
            .await
            .with_context(|| format!("flush after {subject}"))?;
        tracing::debug!(%subject, "published");
        Ok(())
    }
}

#[async_trait::async_trait]
impl PayloadSink for NatsSink {
    async fn accept(&self, payload: HookPayload) -> Result<()> {
        let subject = format!("wlog.{}.event.git.{}", self.workspace, payload.kind);
        let body = serde_json::to_vec(&payload)?;
        self.publish(subject, body).await
    }

    async fn accept_cc(&self, payload: HookPayload, extras: serde_json::Value) -> Result<()> {
        // The `payload.kind` field starts with `cc.` because the worker
        // prefixed it; strip that to recover the bare event kind.
        let kind = payload.kind.strip_prefix("cc.").unwrap_or(&payload.kind);
        let subject = format!("wlog.{}.event.cc.{kind}", self.workspace);
        let body = serde_json::to_vec(&extras)?;
        self.publish(subject, body).await
    }
}
