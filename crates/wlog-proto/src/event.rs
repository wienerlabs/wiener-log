//! Ingestion event types.
//!
//! Every signal that reaches the synthesis engine starts life as an [`Event`].
//! The shape is intentionally narrow so that ingestion adapters can produce
//! events without depending on storage details.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::task::WorkspaceId;

/// Where an event originated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventSource {
    /// A local git repository hook.
    Git,
    /// A Claude Code session probe.
    ClaudeCode,
    /// A GitHub webhook delivery.
    GitHub,
}

/// The semantic kind of an event within its source. The wire string is the
/// authoritative form because new kinds will be added without recompilation
/// of every consumer.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct EventKind(pub String);

impl EventKind {
    /// Wrap a string literal as an [`EventKind`].
    pub fn new(kind: impl Into<String>) -> Self {
        Self(kind.into())
    }

    /// Borrow the underlying string.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A single ingestion event. The opaque `payload` carries source-specific
/// data; the engine learns its shape through versioned schemas referenced by
/// `(source, kind)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// Unique event identifier, assigned at ingestion time.
    pub id: Uuid,
    /// Workspace that owns this event.
    pub workspace_id: WorkspaceId,
    /// Source adapter that produced the event.
    pub source: EventSource,
    /// Source-specific event kind.
    pub kind: EventKind,
    /// Free-form JSON payload, schema indexed by `(source, kind)`.
    pub payload: serde_json::Value,
    /// When the underlying activity actually happened.
    pub occurred_at: DateTime<Utc>,
}

impl Event {
    /// Convenience constructor that auto-generates an id and treats
    /// `occurred_at` as the timestamp the activity took place.
    pub fn new(
        workspace_id: WorkspaceId,
        source: EventSource,
        kind: impl Into<String>,
        payload: serde_json::Value,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            workspace_id,
            source,
            kind: EventKind::new(kind),
            payload,
            occurred_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    #[test]
    fn event_round_trips_through_json() {
        let event = Event::new(
            WorkspaceId(Uuid::nil()),
            EventSource::Git,
            "commit",
            serde_json::json!({"sha": "deadbeef"}),
            Utc.with_ymd_and_hms(2026, 5, 26, 12, 0, 0).unwrap(),
        );
        let wire = serde_json::to_string(&event).expect("serialize");
        let parsed: Event = serde_json::from_str(&wire).expect("deserialize");
        assert_eq!(parsed.kind.as_str(), "commit");
        assert_eq!(parsed.source, EventSource::Git);
    }
}
