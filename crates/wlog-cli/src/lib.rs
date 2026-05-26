//! Public surface for the `wlog` CLI.
//!
//! The CLI binary in `src/main.rs` is thin; the substance lives in the
//! modules re-exported here so that integration tests under
//! `crates/wlog-cli/tests/` can drive them directly without spawning
//! a subprocess.

#![warn(missing_docs)]

pub mod config;
pub mod daemon;
pub mod output;
