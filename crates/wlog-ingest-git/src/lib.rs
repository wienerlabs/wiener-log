//! Git ingestion library.
//!
//! Provides hook installation primitives and the event-shaping helpers
//! consumed by the `wlog-ingest-git` binary. Phase 1 fills in the
//! commit-parsing pipeline.

#![warn(missing_docs)]

/// Crate version, surfaced in logs and event provenance.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
