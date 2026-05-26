//! Edge repository (minimal Phase 0 surface).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use wlog_proto::{Edge, EdgeId, EdgeType, TaskId, WorkspaceId};

use crate::StorageError;
use crate::db_types::DbEdgeType;

/// Typed access to the `edges` table.
#[derive(Debug, Clone)]
pub struct EdgeRepo {
    pool: PgPool,
}

#[derive(sqlx::FromRow)]
struct EdgeRow {
    id: uuid::Uuid,
    workspace_id: uuid::Uuid,
    from_task: uuid::Uuid,
    to_task: uuid::Uuid,
    edge_type: DbEdgeType,
    created_at: DateTime<Utc>,
}

impl EdgeRow {
    fn into_edge(self) -> Edge {
        Edge {
            id: EdgeId(self.id),
            workspace_id: WorkspaceId(self.workspace_id),
            from_task: TaskId(self.from_task),
            to_task: TaskId(self.to_task),
            edge_type: self.edge_type.into(),
            created_at: self.created_at,
        }
    }
}

impl EdgeRepo {
    /// Wrap a pool for edge queries.
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Insert an edge and return the persisted row.
    pub async fn create(
        &self,
        workspace_id: WorkspaceId,
        from_task: TaskId,
        to_task: TaskId,
        edge_type: EdgeType,
    ) -> Result<Edge, StorageError> {
        if from_task.0 == to_task.0 {
            return Err(StorageError::Invalid("self-edges are not allowed".into()));
        }
        let row: EdgeRow = sqlx::query_as(
            "INSERT INTO edges (workspace_id, from_task, to_task, edge_type) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, workspace_id, from_task, to_task, edge_type, created_at",
        )
        .bind(workspace_id.0)
        .bind(from_task.0)
        .bind(to_task.0)
        .bind(DbEdgeType::from(edge_type))
        .fetch_one(&self.pool)
        .await?;
        Ok(row.into_edge())
    }

    /// Edges originating at `task`.
    pub async fn outgoing(&self, task: TaskId) -> Result<Vec<Edge>, StorageError> {
        let rows: Vec<EdgeRow> = sqlx::query_as(
            "SELECT id, workspace_id, from_task, to_task, edge_type, created_at \
             FROM edges WHERE from_task = $1 ORDER BY created_at ASC",
        )
        .bind(task.0)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(EdgeRow::into_edge).collect())
    }

    /// Edges terminating at `task`.
    pub async fn incoming(&self, task: TaskId) -> Result<Vec<Edge>, StorageError> {
        let rows: Vec<EdgeRow> = sqlx::query_as(
            "SELECT id, workspace_id, from_task, to_task, edge_type, created_at \
             FROM edges WHERE to_task = $1 ORDER BY created_at ASC",
        )
        .bind(task.0)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(EdgeRow::into_edge).collect())
    }
}
