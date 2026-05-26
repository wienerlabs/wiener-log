//! Database-side enum wrappers and converters to/from `wlog-proto` types.
//!
//! Postgres custom enums (`node_type`, `edge_type`) are bound through sqlx
//! `Type` derives so that queries can read and write them directly. The
//! proto types are kept driver-agnostic; the converters in this module
//! bridge the two worlds.

use sqlx::Type;
use wlog_proto::{EdgeType, NodeType};

use crate::StorageError;

/// Driver-side wrapper for the Postgres `node_type` enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type)]
#[sqlx(type_name = "node_type", rename_all = "snake_case")]
pub enum DbNodeType {
    /// Maps to `intent`.
    Intent,
    /// Maps to `decomposition`.
    Decomposition,
    /// Maps to `execution`.
    Execution,
    /// Maps to `outcome`.
    Outcome,
}

impl From<NodeType> for DbNodeType {
    fn from(value: NodeType) -> Self {
        match value {
            NodeType::Intent => Self::Intent,
            NodeType::Decomposition => Self::Decomposition,
            NodeType::Execution => Self::Execution,
            NodeType::Outcome => Self::Outcome,
        }
    }
}

impl From<DbNodeType> for NodeType {
    fn from(value: DbNodeType) -> Self {
        match value {
            DbNodeType::Intent => Self::Intent,
            DbNodeType::Decomposition => Self::Decomposition,
            DbNodeType::Execution => Self::Execution,
            DbNodeType::Outcome => Self::Outcome,
        }
    }
}

/// Driver-side wrapper for the Postgres `edge_type` enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type)]
#[sqlx(type_name = "edge_type", rename_all = "snake_case")]
pub enum DbEdgeType {
    /// Maps to `depends_on`.
    DependsOn,
    /// Maps to `decomposes_into`.
    DecomposesInto,
    /// Maps to `executes`.
    Executes,
    /// Maps to `resolves`.
    Resolves,
}

impl From<EdgeType> for DbEdgeType {
    fn from(value: EdgeType) -> Self {
        match value {
            EdgeType::DependsOn => Self::DependsOn,
            EdgeType::DecomposesInto => Self::DecomposesInto,
            EdgeType::Executes => Self::Executes,
            EdgeType::Resolves => Self::Resolves,
        }
    }
}

impl From<DbEdgeType> for EdgeType {
    fn from(value: DbEdgeType) -> Self {
        match value {
            DbEdgeType::DependsOn => Self::DependsOn,
            DbEdgeType::DecomposesInto => Self::DecomposesInto,
            DbEdgeType::Executes => Self::Executes,
            DbEdgeType::Resolves => Self::Resolves,
        }
    }
}

/// Parse a textual status returned from the database.
pub fn parse_status(s: &str) -> Result<wlog_proto::TaskStatus, StorageError> {
    wlog_proto::TaskStatus::parse(s).ok_or_else(|| StorageError::UnknownEnum(format!("status={s}")))
}

/// Parse a textual event source returned from the database.
pub fn parse_event_source(s: &str) -> Result<wlog_proto::EventSource, StorageError> {
    Ok(match s {
        "git" => wlog_proto::EventSource::Git,
        "claude_code" => wlog_proto::EventSource::ClaudeCode,
        "github" => wlog_proto::EventSource::GitHub,
        other => return Err(StorageError::UnknownEnum(format!("source={other}"))),
    })
}

/// Serialize an event source for insertion.
pub const fn event_source_str(source: wlog_proto::EventSource) -> &'static str {
    match source {
        wlog_proto::EventSource::Git => "git",
        wlog_proto::EventSource::ClaudeCode => "claude_code",
        wlog_proto::EventSource::GitHub => "github",
    }
}
