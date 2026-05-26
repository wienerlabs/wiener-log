//! Task DAG types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Workspace primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct WorkspaceId(pub Uuid);

impl WorkspaceId {
    /// Borrow the underlying UUID.
    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

/// Task node primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TaskId(pub Uuid);

impl TaskId {
    /// Borrow the underlying UUID.
    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }

    /// Short identifier suitable for human display (first 8 hex chars).
    pub fn short(&self) -> String {
        let s = self.0.simple().to_string();
        s.chars().take(8).collect()
    }
}

/// User primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UserId(pub Uuid);

impl UserId {
    /// Borrow the underlying UUID.
    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

/// Edge primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct EdgeId(pub Uuid);

/// What part of the work lifecycle a node represents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    /// A stated intent or goal, before decomposition.
    Intent,
    /// A unit of work produced by decomposing an intent.
    Decomposition,
    /// A concrete execution attempt (commit cluster, agent run).
    Execution,
    /// The observed outcome of executions (merged PR, fixed bug, regression).
    Outcome,
}

impl NodeType {
    /// Wire-format string used in the database `node_type` enum.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Intent => "intent",
            Self::Decomposition => "decomposition",
            Self::Execution => "execution",
            Self::Outcome => "outcome",
        }
    }

    /// Parse a node type from its wire string.
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "intent" => Self::Intent,
            "decomposition" => Self::Decomposition,
            "execution" => Self::Execution,
            "outcome" => Self::Outcome,
            _ => return None,
        })
    }
}

/// How a task is moving through review and execution.
///
/// The wire string is matched against the `status` CHECK constraint in
/// the database. Adding a value here without updating the migration is
/// caught by the integration tests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    /// Synthesized by the engine, awaiting human review.
    Proposed,
    /// Human has acknowledged the proposal.
    Acked,
    /// Work has started.
    InProgress,
    /// Work is finished and observed in source.
    Done,
    /// Rejected by reviewer, kept for calibration only.
    Rejected,
}

impl TaskStatus {
    /// Wire-format string used in the database `status` column.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Proposed => "proposed",
            Self::Acked => "acked",
            Self::InProgress => "in_progress",
            Self::Done => "done",
            Self::Rejected => "rejected",
        }
    }

    /// Parse a status from its wire string.
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "proposed" => Self::Proposed,
            "acked" => Self::Acked,
            "in_progress" => Self::InProgress,
            "done" => Self::Done,
            "rejected" => Self::Rejected,
            _ => return None,
        })
    }

    /// Whether a transition from `self` to `next` is legal.
    pub const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Proposed, Self::Acked | Self::Rejected)
                | (Self::Acked, Self::InProgress | Self::Rejected)
                | (Self::InProgress, Self::Done | Self::Rejected)
        )
    }
}

/// Edge semantics between two task nodes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    /// Source depends on target before it can start.
    DependsOn,
    /// Source decomposes into target.
    DecomposesInto,
    /// Source executes target (commit, PR, agent run).
    Executes,
    /// Source resolves target (closes the loop).
    Resolves,
}

impl EdgeType {
    /// Wire-format string used in the database `edge_type` enum.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DependsOn => "depends_on",
            Self::DecomposesInto => "decomposes_into",
            Self::Executes => "executes",
            Self::Resolves => "resolves",
        }
    }

    /// Parse an edge type from its wire string.
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "depends_on" => Self::DependsOn,
            "decomposes_into" => Self::DecomposesInto,
            "executes" => Self::Executes,
            "resolves" => Self::Resolves,
            _ => return None,
        })
    }
}

/// A node in the task DAG.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNode {
    /// Task identifier.
    pub id: TaskId,
    /// Workspace that owns this task.
    pub workspace_id: WorkspaceId,
    /// Where the node sits in the work lifecycle.
    pub node_type: NodeType,
    /// Short title, displayable in CLI list views.
    pub title: String,
    /// Long-form body, may be empty for early proposals.
    pub body: Option<String>,
    /// Originating repository slug, if applicable.
    pub repo: Option<String>,
    /// Assigned owner.
    pub owner: Option<UserId>,
    /// Current review status.
    pub status: TaskStatus,
    /// Whether this node already carries an embedding vector.
    pub embedding_present: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last mutation timestamp.
    pub updated_at: DateTime<Utc>,
}

/// A directed edge in the task DAG.
#[allow(clippy::struct_field_names)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    /// Edge identifier.
    pub id: EdgeId,
    /// Workspace that owns this edge.
    pub workspace_id: WorkspaceId,
    /// Origin task.
    pub from_task: TaskId,
    /// Destination task.
    pub to_task: TaskId,
    /// Semantic kind.
    pub edge_type: EdgeType,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_type_round_trips() {
        for nt in [
            NodeType::Intent,
            NodeType::Decomposition,
            NodeType::Execution,
            NodeType::Outcome,
        ] {
            assert_eq!(NodeType::parse(nt.as_str()), Some(nt));
        }
    }

    #[test]
    fn task_status_round_trips() {
        for s in [
            TaskStatus::Proposed,
            TaskStatus::Acked,
            TaskStatus::InProgress,
            TaskStatus::Done,
            TaskStatus::Rejected,
        ] {
            assert_eq!(TaskStatus::parse(s.as_str()), Some(s));
        }
    }

    #[test]
    fn edge_type_round_trips() {
        for e in [
            EdgeType::DependsOn,
            EdgeType::DecomposesInto,
            EdgeType::Executes,
            EdgeType::Resolves,
        ] {
            assert_eq!(EdgeType::parse(e.as_str()), Some(e));
        }
    }

    #[test]
    fn status_transitions_match_lifecycle() {
        use TaskStatus::*;
        assert!(Proposed.can_transition_to(Acked));
        assert!(Proposed.can_transition_to(Rejected));
        assert!(Acked.can_transition_to(InProgress));
        assert!(InProgress.can_transition_to(Done));
        assert!(!Done.can_transition_to(Proposed));
        assert!(!Rejected.can_transition_to(Acked));
        assert!(!Proposed.can_transition_to(Done));
    }

    #[test]
    fn task_id_short_returns_eight_hex_chars() {
        let id = TaskId(uuid::Uuid::nil());
        assert_eq!(id.short(), "00000000");
    }
}
