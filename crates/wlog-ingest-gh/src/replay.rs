//! Replay-protection LRU. Bounded to keep the working set small.

use std::collections::{HashSet, VecDeque};
use std::sync::Mutex;

/// Bounded set that remembers the last `cap` delivery IDs. `contains`
/// is O(1); `insert` evicts the oldest entry when at capacity.
#[derive(Debug)]
pub struct ReplayCache {
    cap: usize,
    inner: Mutex<Inner>,
}

#[derive(Debug, Default)]
struct Inner {
    set: HashSet<String>,
    order: VecDeque<String>,
}

impl ReplayCache {
    /// Construct a cache with the given capacity.
    pub fn new(cap: usize) -> Self {
        Self {
            cap,
            inner: Mutex::new(Inner::default()),
        }
    }

    /// Returns `true` if `id` has been seen before. Otherwise records
    /// it and returns `false`.
    pub fn check_and_insert(&self, id: &str) -> bool {
        let mut inner = self
            .inner
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if inner.set.contains(id) {
            return true;
        }
        if inner.order.len() >= self.cap
            && let Some(oldest) = inner.order.pop_front()
        {
            inner.set.remove(&oldest);
        }
        inner.set.insert(id.to_string());
        inner.order.push_back(id.to_string());
        false
    }
}

impl Default for ReplayCache {
    fn default() -> Self {
        Self::new(1000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_insert_returns_false() {
        let cache = ReplayCache::new(10);
        assert!(!cache.check_and_insert("a"));
    }

    #[test]
    fn repeat_insert_returns_true() {
        let cache = ReplayCache::new(10);
        assert!(!cache.check_and_insert("a"));
        assert!(cache.check_and_insert("a"));
    }

    #[test]
    fn capacity_evicts_oldest() {
        let cache = ReplayCache::new(3);
        cache.check_and_insert("a");
        cache.check_and_insert("b");
        cache.check_and_insert("c");
        cache.check_and_insert("d");
        // "a" was the oldest of four entries with cap=3 -> evicted.
        assert!(!cache.check_and_insert("a"), "a should have been evicted");
        // "b", "c", and "d" still present (until further evictions).
        // Re-inserting "d" must report it as already present.
        assert!(cache.check_and_insert("d"), "d should still be present");
    }
}
