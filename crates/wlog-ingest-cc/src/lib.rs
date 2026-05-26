//! Claude Code session probe library.
//!
//! Watches `~/.claude/projects/` for new JSONL session files, parses message
//! batches, and emits `cc.session_*` events. Phase 1 implements the watcher.

#![warn(missing_docs)]

/// Crate version, surfaced in logs and event provenance.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
