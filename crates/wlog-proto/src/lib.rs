//! WienerLog shared protocol types.
//!
//! This crate defines the type contracts that flow between ingestion, storage,
//! engine, and surface layers. Anything that crosses a process boundary or a
//! NATS subject lives here so that producers and consumers stay in lockstep.
//!
//! No business logic. No I/O. Only types, traits, and the errors they raise.

#![warn(missing_docs)]

pub mod event;
pub mod task;

pub use event::{Event, EventKind, EventSource};
pub use task::{
    Edge, EdgeId, EdgeType, NodeType, TaskId, TaskNode, TaskStatus, UserId, WorkspaceId,
};

/// Crate version, exposed for diagnostics and prompt provenance.
pub const PROTO_VERSION: &str = env!("CARGO_PKG_VERSION");
