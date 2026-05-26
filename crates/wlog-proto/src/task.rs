//! Task DAG types.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Workspace primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct WorkspaceId(pub Uuid);

/// Task node primary key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TaskId(pub Uuid);

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

/// How a task is moving through review and execution.
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

/// Edge semantics between two task nodes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    /// Source depends on target before it can start.
    DependsOn,
    /// Source decomposes into target.
    DecomposesInto,
    /// Source executes target (commit / PR / agent run).
    Executes,
    /// Source resolves target (closes the loop).
    Resolves,
}

/// A node in the task DAG. Phase 0 keeps this minimal; the engine layer
/// hangs additional structures (estimates, embeddings, provenance) off the
/// identifier rather than fattening this type.
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
    /// Current review status.
    pub status: TaskStatus,
}
