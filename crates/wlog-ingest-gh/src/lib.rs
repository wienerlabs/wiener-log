//! GitHub webhook receiver library.
//!
//! Hosts an Axum HTTP server that verifies webhook HMAC signatures and
//! republishes deliveries onto NATS. Phase 1 implements the routes.

#![warn(missing_docs)]

/// Crate version, surfaced in logs and event provenance.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
