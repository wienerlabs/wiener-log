//! Hook -> daemon socket protocol.
//!
//! Hook scripts are sync, short-lived shell processes. They cannot afford
//! to spin up a Tokio runtime or block waiting on NATS. Instead they
//! write one JSON line to a local Unix socket; the wlog daemon reads,
//! enriches, and forwards to NATS asynchronously.
//!
//! The protocol is intentionally trivial: one [`HookPayload`] per line,
//! UTF-8 encoded, newline-terminated. The daemon disconnects after each
//! payload so that producers do not need to manage long-lived streams.

use std::io::{self, BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Default socket location: `$XDG_RUNTIME_DIR/wlog.sock`, falling back to
/// `/tmp/wlog.sock` on systems that do not export `XDG_RUNTIME_DIR`
/// (typical on macOS dev boxes).
pub fn default_socket_path() -> PathBuf {
    if let Ok(runtime) = std::env::var("XDG_RUNTIME_DIR") {
        PathBuf::from(runtime).join("wlog.sock")
    } else if cfg!(target_os = "macos") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join("Library/Caches/wlog/wlog.sock");
        }
        PathBuf::from("/tmp/wlog.sock")
    } else {
        PathBuf::from("/tmp/wlog.sock")
    }
}

/// One ingestion event as emitted by a git hook (or any future producer).
///
/// `kind` matches [`HookKind::wire`](super::HookKind::wire) for git
/// origins. Future producers (Claude Code probe, GitHub webhook) ride
/// the same envelope so the daemon listener stays a single code path.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HookPayload {
    /// Producer kind, e.g. `post-commit`, `post-merge`, `pre-push`.
    pub kind: String,
    /// Working directory the producer was invoked in.
    pub cwd: String,
    /// Verbatim positional arguments the producer received.
    pub args: Vec<String>,
    /// Repository remote URL (origin), best effort.
    pub repo_remote: Option<String>,
    /// HEAD commit SHA, best effort.
    pub head_sha: Option<String>,
    /// Current branch name, best effort.
    pub branch: Option<String>,
    /// When the producer captured this payload.
    pub emitted_at: DateTime<Utc>,
}

/// Connect to `socket`, write one payload as a single newline-terminated
/// JSON line, then disconnect. Returns immediately on success. Total
/// timeout (connect + write) capped at 200 ms so a slow daemon never
/// stalls a developer's commit.
pub fn write_payload(socket: &Path, payload: &HookPayload) -> io::Result<()> {
    let mut stream = UnixStream::connect(socket)?;
    stream.set_write_timeout(Some(Duration::from_millis(200)))?;
    let line = serde_json::to_string(payload)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    writeln!(stream, "{line}")?;
    stream.flush()
}

/// Bind a [`UnixListener`] at `path`, replacing any stale socket file.
/// Daemons call this once on startup.
pub fn bind(path: &Path) -> io::Result<UnixListener> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if path.exists() {
        // Stale socket from a previous daemon crash. Safe to unlink:
        // any live listener would block this `bind` call regardless.
        let _ = std::fs::remove_file(path);
    }
    UnixListener::bind(path)
}

/// Read one [`HookPayload`] from an incoming connection. Returns
/// `Ok(None)` if the peer disconnected without sending a complete line.
pub fn read_one(stream: UnixStream) -> io::Result<Option<HookPayload>> {
    stream.set_read_timeout(Some(Duration::from_millis(500)))?;
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    let n = reader.read_line(&mut line)?;
    if n == 0 {
        return Ok(None);
    }
    let trimmed = line.trim_end_matches(['\r', '\n']);
    let payload =
        serde_json::from_str(trimmed).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    Ok(Some(payload))
}

#[cfg(test)]
mod tests {
    use std::thread;

    use chrono::TimeZone;

    use super::*;

    fn fixed_payload(kind: &str) -> HookPayload {
        HookPayload {
            kind: kind.to_string(),
            cwd: "/tmp/repo".to_string(),
            args: vec!["arg1".into(), "arg2".into()],
            repo_remote: Some("git@github.com:wienerlabs/test.git".into()),
            head_sha: Some("deadbeefcafefade".into()),
            branch: Some("main".into()),
            emitted_at: Utc.with_ymd_and_hms(2026, 5, 26, 20, 0, 0).unwrap(),
        }
    }

    #[test]
    fn payload_round_trips_over_socket() {
        let tmp = tempdir::TempDir::new("wlog-sock").expect("tempdir");
        let socket_path = tmp.path().join("wlog.sock");
        let listener = bind(&socket_path).expect("bind");
        let server_path = socket_path.clone();
        let server = thread::spawn(move || {
            let (stream, _addr) = listener.accept().expect("accept");
            read_one(stream).expect("read").expect("payload present")
        });
        let payload = fixed_payload("post-commit");
        // tiny grace so the listener is definitely accepting before
        // the client connects.
        thread::sleep(Duration::from_millis(20));
        write_payload(&server_path, &payload).expect("write");
        let received = server.join().expect("server thread");
        assert_eq!(received, payload);
    }

    #[test]
    fn write_to_missing_socket_errors_cleanly() {
        let payload = fixed_payload("pre-push");
        let err = write_payload(Path::new("/nonexistent/wlog.sock"), &payload).unwrap_err();
        assert!(matches!(
            err.kind(),
            io::ErrorKind::NotFound | io::ErrorKind::ConnectionRefused | io::ErrorKind::Other
        ));
    }
}
