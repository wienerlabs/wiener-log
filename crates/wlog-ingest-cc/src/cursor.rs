//! Cursor persistence for the Claude Code probe.
//!
//! The probe scans the same JSONL files repeatedly; the cursor records
//! how many bytes of each file the probe has already shipped so that
//! subsequent scans only emit new lines. Cursor state is serialized as
//! JSON to keep the file human-inspectable on disk.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// State persisted between scans.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScannerCursor {
    /// Per-file byte offset and bookkeeping. Keyed by canonical path.
    pub files: BTreeMap<String, FileCursor>,
}

/// State for a single session file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCursor {
    /// Byte offset already shipped.
    pub offset: u64,
    /// Wall-clock time of the last line shipped from this file.
    pub last_seen_at: DateTime<Utc>,
    /// Total messages shipped so far.
    pub message_count: u32,
    /// Whether the probe has emitted a `session_ended` event already.
    pub ended: bool,
}

impl FileCursor {
    /// A blank cursor at offset 0.
    pub fn fresh() -> Self {
        Self {
            offset: 0,
            last_seen_at: Utc::now(),
            message_count: 0,
            ended: false,
        }
    }
}

impl ScannerCursor {
    /// Read a cursor from disk; returns an empty cursor if the file is
    /// missing.
    pub fn load(path: &Path) -> io::Result<Self> {
        match fs::read_to_string(path) {
            Ok(text) => {
                let parsed: Self = serde_json::from_str(&text)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                Ok(parsed)
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e),
        }
    }

    /// Persist the cursor to disk. Writes atomically by way of a
    /// `<path>.tmp` sibling and a rename.
    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = tmp_sibling(path);
        let text = serde_json::to_string_pretty(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&tmp, text)?;
        fs::rename(tmp, path)?;
        Ok(())
    }

    /// Default cursor path, under `$XDG_STATE_HOME/wlog/cc-cursor.json`.
    pub fn default_path() -> PathBuf {
        if let Ok(state) = std::env::var("XDG_STATE_HOME") {
            return PathBuf::from(state).join("wlog").join("cc-cursor.json");
        }
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join(".local")
                .join("state")
                .join("wlog")
                .join("cc-cursor.json");
        }
        PathBuf::from("./wlog-cc-cursor.json")
    }
}

fn tmp_sibling(path: &Path) -> PathBuf {
    let mut name = path.file_name().map_or_else(
        || std::ffi::OsString::from("cursor"),
        std::ffi::OsString::from,
    );
    name.push(".tmp");
    path.with_file_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_returns_default_when_file_missing() {
        let cursor = ScannerCursor::load(Path::new("/nonexistent/cursor.json")).unwrap();
        assert!(cursor.files.is_empty());
    }

    #[test]
    fn save_then_load_round_trips() {
        let tmp = tempdir::TempDir::new("wlog-cursor").unwrap();
        let path = tmp.path().join("cursor.json");
        let mut cursor = ScannerCursor::default();
        cursor.files.insert(
            "/tmp/session.jsonl".to_string(),
            FileCursor {
                offset: 42,
                last_seen_at: Utc::now(),
                message_count: 3,
                ended: false,
            },
        );
        cursor.save(&path).unwrap();
        let loaded = ScannerCursor::load(&path).unwrap();
        assert_eq!(loaded.files.len(), 1);
        let entry = loaded.files.get("/tmp/session.jsonl").unwrap();
        assert_eq!(entry.offset, 42);
        assert_eq!(entry.message_count, 3);
        assert!(!entry.ended);
    }
}
