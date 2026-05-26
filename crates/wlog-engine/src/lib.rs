//! WienerLog engine.
//!
//! Phase 0 provides the skeleton modules; Phases 1 through 3 implement
//! synthesis, calibration, and dispatch respectively. Each module ships its
//! own README under `crates/wlog-engine/docs/` when it lands.

#![warn(missing_docs)]

/// Engine version, surfaced in prompt provenance and logs.
pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub mod calibration;
pub mod cost;
pub mod dispatch;
pub mod llm;
pub mod synth;
