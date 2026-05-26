//! Event batching layer.
//!
//! Phase 1 #31. Groups events by `(workspace_id, owner, repo)` and
//! flushes either when a batch hits [`Builder::max_size`] events or
//! when it ages past [`Builder::window`]. The synthesis worker calls
//! [`Builder::add`] / [`Builder::flush_expired`] / [`Builder::flush_all`]
//! in its loop and feeds the resulting [`Batch`]es to the prompt
//! pipeline.
//!
//! The builder is intentionally type-generic over the event payload so
//! the synthesis engine can use it with either `wlog_proto::Event` or
//! a richer wrapper that carries provenance.

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use wlog_proto::{UserId, WorkspaceId};

/// Tuple that identifies a batch's owner.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BatchKey {
    /// Workspace the events belong to.
    pub workspace_id: WorkspaceId,
    /// Optional event owner; `None` groups unassigned events together.
    pub owner: Option<UserId>,
    /// Optional repository slug.
    pub repo: Option<String>,
}

/// One batch ready to be synthesized.
#[derive(Debug, Clone)]
pub struct Batch<E> {
    /// Identity of the batch.
    pub key: BatchKey,
    /// Events in arrival order.
    pub events: Vec<E>,
    /// When the first event arrived.
    pub started_at: DateTime<Utc>,
    /// When the batch was closed.
    pub closed_at: DateTime<Utc>,
}

/// Stateful batch accumulator.
#[derive(Debug, Clone)]
pub struct Builder<E> {
    window: Duration,
    max_size: usize,
    batches: HashMap<BatchKey, Open<E>>,
}

#[derive(Debug, Clone)]
struct Open<E> {
    events: Vec<E>,
    started_at: DateTime<Utc>,
}

impl<E> Builder<E> {
    /// Construct a builder with the given window + size limits.
    pub fn new(window: Duration, max_size: usize) -> Self {
        Self {
            window,
            max_size,
            batches: HashMap::new(),
        }
    }

    /// Default policy: 4-hour rolling window, 50-event cap (mandate
    /// §5.3 batching layer).
    pub fn standard() -> Self {
        Self::new(Duration::from_secs(4 * 60 * 60), 50)
    }

    /// Window in effect.
    pub const fn window(&self) -> Duration {
        self.window
    }

    /// Cap in effect.
    pub const fn max_size(&self) -> usize {
        self.max_size
    }

    /// Number of currently open batches.
    pub fn open_count(&self) -> usize {
        self.batches.len()
    }

    /// Add `event` for `key` at wall-clock `now`. Returns any batches
    /// closed as a side effect (only the matching key can close in
    /// this call, by hitting the size cap).
    pub fn add(&mut self, key: BatchKey, event: E, now: DateTime<Utc>) -> Vec<Batch<E>> {
        let entry = self.batches.entry(key.clone()).or_insert_with(|| Open {
            events: Vec::with_capacity(self.max_size),
            started_at: now,
        });
        entry.events.push(event);
        if entry.events.len() >= self.max_size {
            let open = self.batches.remove(&key).expect("entry just inserted");
            return vec![Batch {
                key,
                events: open.events,
                started_at: open.started_at,
                closed_at: now,
            }];
        }
        Vec::new()
    }

    /// Close batches whose `started_at` is older than `window`.
    pub fn flush_expired(&mut self, now: DateTime<Utc>) -> Vec<Batch<E>> {
        let cutoff =
            now - chrono::Duration::from_std(self.window).unwrap_or(chrono::Duration::zero());
        let expired_keys: Vec<BatchKey> = self
            .batches
            .iter()
            .filter(|(_, open)| open.started_at <= cutoff)
            .map(|(k, _)| k.clone())
            .collect();
        let mut out = Vec::with_capacity(expired_keys.len());
        for key in expired_keys {
            let open = self.batches.remove(&key).expect("key was just listed");
            out.push(Batch {
                key,
                events: open.events,
                started_at: open.started_at,
                closed_at: now,
            });
        }
        out
    }

    /// Close every open batch immediately (e.g. on shutdown or manual
    /// `wlog daily` invocation).
    pub fn flush_all(&mut self, now: DateTime<Utc>) -> Vec<Batch<E>> {
        let keys: Vec<BatchKey> = self.batches.keys().cloned().collect();
        let mut out = Vec::with_capacity(keys.len());
        for key in keys {
            let open = self.batches.remove(&key).expect("key was just listed");
            out.push(Batch {
                key,
                events: open.events,
                started_at: open.started_at,
                closed_at: now,
            });
        }
        out
    }
}

impl<E> Default for Builder<E> {
    fn default() -> Self {
        Self::standard()
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;
    use uuid::Uuid;

    use super::*;

    fn key(slug: &str) -> BatchKey {
        BatchKey {
            workspace_id: WorkspaceId(Uuid::new_v4()),
            owner: None,
            repo: Some(slug.to_string()),
        }
    }

    fn t(offset_minutes: i64) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 5, 26, 20, 0, 0).unwrap()
            + chrono::Duration::minutes(offset_minutes)
    }

    const FOUR_HOURS_IN_SECS: u64 = 4 * 60 * 60;

    #[test]
    fn add_below_cap_keeps_batch_open() {
        let mut b: Builder<u32> = Builder::new(Duration::from_secs(3600), 5);
        let k = key("aperture");
        for i in 0..4 {
            assert!(b.add(k.clone(), i, t(i64::from(i))).is_empty());
        }
        assert_eq!(b.open_count(), 1);
    }

    #[test]
    fn hitting_cap_closes_batch() {
        let mut b: Builder<u32> = Builder::new(Duration::from_secs(3600), 3);
        let k = key("aperture");
        assert!(b.add(k.clone(), 0, t(0)).is_empty());
        assert!(b.add(k.clone(), 1, t(1)).is_empty());
        let closed = b.add(k.clone(), 2, t(2));
        assert_eq!(closed.len(), 1);
        assert_eq!(closed[0].events.len(), 3);
        assert_eq!(b.open_count(), 0);
    }

    #[test]
    fn flush_expired_only_closes_old_batches() {
        let mut b: Builder<u32> = Builder::new(Duration::from_secs(60), 100);
        let old = key("aperture");
        let fresh = key("covenant");
        b.add(old.clone(), 0, t(0));
        b.add(fresh.clone(), 0, t(5));
        let closed = b.flush_expired(t(2));
        // Window 60s; at t(2 minutes) the old batch is past its window
        // (started at t=0, 2 minutes elapsed) but not the fresh one.
        assert_eq!(closed.len(), 1);
        assert_eq!(closed[0].key, old);
        assert_eq!(b.open_count(), 1);
    }

    #[test]
    fn flush_all_drains_state() {
        let mut b: Builder<u32> = Builder::new(Duration::from_secs(60), 100);
        b.add(key("a"), 0, t(0));
        b.add(key("b"), 0, t(0));
        let closed = b.flush_all(t(1));
        assert_eq!(closed.len(), 2);
        assert_eq!(b.open_count(), 0);
    }

    #[test]
    fn standard_defaults_are_4_hours_and_50() {
        let b: Builder<u32> = Builder::standard();
        assert_eq!(b.window(), Duration::from_secs(FOUR_HOURS_IN_SECS));
        assert_eq!(b.max_size(), 50);
    }
}
