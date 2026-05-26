//! Scanner: read new lines, produce [`CcEvent`]s, mutate the cursor.

use std::fs::File;
use std::io::{self, BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::CcEvent;
use crate::cursor::{FileCursor, ScannerCursor};

/// A session is declared ended after this much wall-clock silence.
pub const SESSION_IDLE: Duration = Duration::from_mins(30);

/// Number of hex characters retained from the SHA-256 of message bodies.
/// Short enough to keep the wire small, long enough to detect dupes.
pub const CONTENT_HASH_LEN: usize = 16;

/// Walk every session file under `projects_dir`, emit new events.
///
/// Returns the new events in chronological order. The supplied cursor
/// is updated in place; callers persist it with `cursor.save(&path)`.
pub fn scan(projects_dir: &Path, cursor: &mut ScannerCursor) -> io::Result<Vec<CcEvent>> {
    let mut emitted = Vec::new();
    if !projects_dir.is_dir() {
        return Ok(emitted);
    }
    let now = Utc::now();
    let mut visited = std::collections::HashSet::new();

    for project_entry in std::fs::read_dir(projects_dir)? {
        let project_entry = project_entry?;
        if !project_entry.file_type()?.is_dir() {
            continue;
        }
        let project_path = project_entry.path();
        let project_label = project_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        for session_entry in std::fs::read_dir(&project_path)? {
            let session_entry = session_entry?;
            if !session_entry.file_type()?.is_file() {
                continue;
            }
            let path = session_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            let key = path.to_string_lossy().into_owned();
            visited.insert(key.clone());
            scan_one_file(&path, &key, &project_label, cursor, &mut emitted, now)?;
        }
    }

    // Close out files that have been idle for SESSION_IDLE.
    let idle_cutoff = now - chrono::Duration::from_std(SESSION_IDLE).unwrap_or_default();
    for (key, file_cursor) in &mut cursor.files {
        if file_cursor.ended {
            continue;
        }
        if file_cursor.last_seen_at < idle_cutoff && !visited.contains(key) {
            file_cursor.ended = true;
            emitted.push(CcEvent::SessionEnded {
                session_id: session_id_from_key(key),
                ended_at: now,
                message_count: file_cursor.message_count,
            });
        }
    }

    Ok(emitted)
}

fn scan_one_file(
    path: &Path,
    key: &str,
    project_label: &str,
    cursor: &mut ScannerCursor,
    emitted: &mut Vec<CcEvent>,
    now: DateTime<Utc>,
) -> io::Result<()> {
    let metadata = std::fs::metadata(path)?;
    let size = metadata.len();

    let mut entry = cursor
        .files
        .get(key)
        .cloned()
        .unwrap_or_else(FileCursor::fresh);

    let first_visit = !cursor.files.contains_key(key);
    if first_visit {
        emitted.push(CcEvent::SessionStarted {
            session_id: session_id_from_path(path),
            project_path: project_label.to_string(),
            seen_at: now,
        });
    }

    if size < entry.offset {
        // File was truncated or rotated; start over.
        tracing::warn!(path = %path.display(), "session file shrunk, resetting cursor");
        entry.offset = 0;
        entry.message_count = 0;
        entry.ended = false;
    }

    if size > entry.offset {
        let mut file = File::open(path)?;
        file.seek(SeekFrom::Start(entry.offset))?;
        let reader = BufReader::new(file);
        for line in reader.lines() {
            let line = line?;
            entry.offset += line.len() as u64 + 1; // +1 for newline
            if let Some(event) = parse_message_line(&line, session_id_from_path(path)) {
                entry.message_count += 1;
                entry.last_seen_at = now;
                emitted.push(event);
            }
        }
        entry.ended = false;
    }

    cursor.files.insert(key.to_string(), entry);
    Ok(())
}

#[derive(Deserialize)]
struct RawLine {
    #[serde(default)]
    r#type: Option<String>,
    #[serde(default)]
    timestamp: Option<String>,
    #[serde(default)]
    message: Option<RawMessage>,
}

#[derive(Deserialize)]
struct RawMessage {
    #[serde(default)]
    role: Option<String>,
    /// Content may be a plain string or a list of typed blocks; we
    /// flatten both shapes into a single byte buffer for hashing.
    #[serde(default)]
    content: Option<serde_json::Value>,
}

fn parse_message_line(line: &str, session_id: String) -> Option<CcEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let raw: RawLine = serde_json::from_str(trimmed).ok()?;
    // The transcript carries many record kinds (summary, tool_use_result,
    // system, hook, etc.). We only ship user/assistant messages.
    let kind = raw.r#type.as_deref()?;
    if kind != "user" && kind != "assistant" {
        return None;
    }
    let message = raw.message?;
    let role = message.role.unwrap_or_else(|| kind.to_string());
    let content_bytes = flatten_content(message.content.as_ref());
    if content_bytes.is_empty() {
        return None;
    }
    let mut hasher = Sha256::new();
    hasher.update(&content_bytes);
    let hex = hex::encode(hasher.finalize());
    let content_hash: String = hex.chars().take(CONTENT_HASH_LEN).collect();
    let approx_tokens = u32::try_from(content_bytes.len().div_ceil(4)).unwrap_or(u32::MAX);
    let occurred_at = raw
        .timestamp
        .as_deref()
        .and_then(parse_rfc3339)
        .unwrap_or_else(Utc::now);
    Some(CcEvent::SessionMessage {
        session_id,
        role,
        content_hash,
        approx_tokens,
        occurred_at,
    })
}

fn flatten_content(value: Option<&serde_json::Value>) -> Vec<u8> {
    let Some(value) = value else {
        return Vec::new();
    };
    match value {
        serde_json::Value::String(s) => s.as_bytes().to_vec(),
        serde_json::Value::Array(items) => {
            let mut out = Vec::new();
            for item in items {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    out.extend_from_slice(text.as_bytes());
                    out.push(b'\n');
                }
            }
            out
        }
        _ => Vec::new(),
    }
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
}

fn session_id_from_path(path: &Path) -> String {
    session_id_from_key(&path.to_string_lossy())
}

fn session_id_from_key(key: &str) -> String {
    PathBuf::from(key)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io::Write;

    use super::*;

    fn write_session(dir: &Path, project: &str, session_id: &str, lines: &[&str]) -> PathBuf {
        let project_dir = dir.join(project);
        fs::create_dir_all(&project_dir).unwrap();
        let file = project_dir.join(format!("{session_id}.jsonl"));
        let mut f = fs::File::create(&file).unwrap();
        for line in lines {
            writeln!(f, "{line}").unwrap();
        }
        file
    }

    #[test]
    fn first_scan_emits_started_plus_messages() {
        let tmp = tempdir::TempDir::new("wlog-cc").unwrap();
        let projects = tmp.path();
        write_session(
            projects,
            "demo",
            "abc",
            &[
                r#"{"type":"summary","summary":"intro"}"#,
                r#"{"type":"user","timestamp":"2026-05-26T20:00:00Z","message":{"role":"user","content":"hello"}}"#,
                r#"{"type":"assistant","timestamp":"2026-05-26T20:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"hi back"}]}}"#,
            ],
        );

        let mut cursor = ScannerCursor::default();
        let events = scan(projects, &mut cursor).unwrap();
        let kinds: Vec<_> = events.iter().map(CcEvent::kind).collect();
        assert_eq!(
            kinds,
            vec!["session_started", "session_message", "session_message"]
        );

        // Second scan with no new lines -> no new events.
        let second = scan(projects, &mut cursor).unwrap();
        assert!(second.is_empty());
    }

    #[test]
    fn appended_line_shows_up_on_next_scan() {
        let tmp = tempdir::TempDir::new("wlog-cc-2").unwrap();
        let projects = tmp.path();
        let file = write_session(
            projects,
            "demo",
            "abc",
            &[
                r#"{"type":"user","timestamp":"2026-05-26T20:00:00Z","message":{"role":"user","content":"ping"}}"#,
            ],
        );

        let mut cursor = ScannerCursor::default();
        let first = scan(projects, &mut cursor).unwrap();
        assert_eq!(
            first
                .iter()
                .filter(|e| matches!(e, CcEvent::SessionMessage { .. }))
                .count(),
            1
        );

        // Append a new line.
        let mut f = fs::OpenOptions::new().append(true).open(&file).unwrap();
        writeln!(
            f,
            r#"{{"type":"assistant","timestamp":"2026-05-26T20:00:02Z","message":{{"role":"assistant","content":"pong"}}}}"#
        )
        .unwrap();

        let second = scan(projects, &mut cursor).unwrap();
        let message_count = second
            .iter()
            .filter(|e| matches!(e, CcEvent::SessionMessage { .. }))
            .count();
        assert_eq!(message_count, 1, "only the appended line ships");
    }

    #[test]
    fn non_message_lines_are_ignored() {
        let tmp = tempdir::TempDir::new("wlog-cc-3").unwrap();
        let projects = tmp.path();
        write_session(
            projects,
            "demo",
            "abc",
            &[
                r#"{"type":"summary"}"#,
                r#"{"type":"system","subtype":"hook"}"#,
                r#"{"type":"tool_use_result"}"#,
            ],
        );
        let mut cursor = ScannerCursor::default();
        let events = scan(projects, &mut cursor).unwrap();
        // Only session_started (no messages).
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind(), "session_started");
    }
}
