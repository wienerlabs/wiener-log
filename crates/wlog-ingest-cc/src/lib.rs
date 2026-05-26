//! Claude Code session probe library.
//!
//! Watches `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` files,
//! parses freshly appended lines, and emits redacted [`CcEvent`] records
//! that the wlog daemon forwards to NATS.
//!
//! Phase 1 redaction policy (mandate §1, "Recording friction = zero"):
//! we never publish raw message text. The probe stores only a SHA-256
//! prefix of the message content, a role, an approximate token count,
//! and the timestamp. The full transcript stays on the developer's
//! local disk and never leaves the machine through wlog.

#![allow(missing_docs)]

pub mod cursor;
pub mod scan;

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub use cursor::ScannerCursor;
pub use scan::scan;

/// Crate version, surfaced in logs and event provenance.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// One event drawn from a Claude Code session transcript. The
/// discriminator (`kind`) maps directly to the wire string used in
/// `wlog.{workspace}.event.cc.{kind}` per ADR-0007.
#[allow(
    clippy::enum_variant_names,
    reason = "every variant is, by definition, a session event"
)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CcEvent {
    /// Emitted the first time the probe sees a session file.
    SessionStarted {
        /// Session UUID parsed from the JSONL filename.
        session_id: String,
        /// Encoded project path (directory name under `projects/`).
        project_path: String,
        /// When the probe noticed the session.
        seen_at: DateTime<Utc>,
    },
    /// Emitted for each new line of role `user` or `assistant`.
    SessionMessage {
        /// Owning session UUID.
        session_id: String,
        /// `user` or `assistant`.
        role: String,
        /// SHA-256 hex prefix (16 chars) of the redacted content.
        content_hash: String,
        /// Approximate token count, derived as `bytes / 4`.
        approx_tokens: u32,
        /// Timestamp recorded in the original message, or now() if
        /// the line omitted one.
        occurred_at: DateTime<Utc>,
    },
    /// Emitted when the probe has not seen a new line in the file for
    /// at least [`scan::SESSION_IDLE`].
    SessionEnded {
        /// Owning session UUID.
        session_id: String,
        /// When the probe declared the session ended.
        ended_at: DateTime<Utc>,
        /// Total messages observed before the idle window.
        message_count: u32,
    },
}

impl CcEvent {
    /// Wire-format kind string (matches NATS subject suffix).
    pub const fn kind(&self) -> &'static str {
        match self {
            Self::SessionStarted { .. } => "session_started",
            Self::SessionMessage { .. } => "session_message",
            Self::SessionEnded { .. } => "session_ended",
        }
    }

    /// Session UUID owning the event.
    pub fn session_id(&self) -> &str {
        match self {
            Self::SessionStarted { session_id, .. }
            | Self::SessionMessage { session_id, .. }
            | Self::SessionEnded { session_id, .. } => session_id,
        }
    }
}

/// Default location of the Claude Code projects directory.
pub fn default_projects_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".claude").join("projects")
    } else {
        PathBuf::from(".claude/projects")
    }
}
