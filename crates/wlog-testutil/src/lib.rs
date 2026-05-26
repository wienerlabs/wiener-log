//! Internal test helpers. Not published.

#![warn(missing_docs)]

use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

use wlog_proto::{Event, EventSource, WorkspaceId};

/// Deterministic Utc timestamp for snapshot tests.
pub fn fixed_now() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 5, 26, 12, 0, 0).unwrap()
}

/// A throwaway workspace id with a fixed value, useful in golden tests.
pub const fn sample_workspace() -> WorkspaceId {
    WorkspaceId(Uuid::nil())
}

/// Build a minimal commit event for tests.
pub fn sample_commit_event(sha: &str) -> Event {
    Event::new(
        sample_workspace(),
        EventSource::Git,
        "commit",
        serde_json::json!({ "sha": sha }),
        fixed_now(),
    )
}
