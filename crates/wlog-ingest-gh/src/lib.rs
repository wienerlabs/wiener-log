//! GitHub webhook receiver library.
//!
//! Hosts an Axum HTTP route at `POST /webhook` that
//!
//! 1. Verifies the `X-Hub-Signature-256` HMAC against a per-workspace
//!    secret using constant-time comparison.
//! 2. Rejects deliveries whose `X-GitHub-Delivery` UUID has already
//!    been seen (in-memory LRU cap, 1000 IDs).
//! 3. Parses the well-known event types from mandate §5.1 (`pull_request`,
//!    `pull_request_review`, `issues`, `issue_comment`, `workflow_run`,
//!    `push`) into [`GhEvent`].
//! 4. Hands every accepted event to an [`EventSink`] that wlog-cli's
//!    daemon implements over its [`PayloadSink`]
//!    (`PayloadSink::accept_gh`).
//!
//! No NATS in this crate; the daemon owns that surface.

#![allow(missing_docs)]

pub mod event;
pub mod hmac;
pub mod replay;
pub mod router;

pub use event::{GhEvent, GhEventKind};
pub use hmac::verify_signature;
pub use replay::ReplayCache;
pub use router::{EventSink, RouterState, build_router, serve};

/// Crate version, surfaced in logs and event provenance.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
