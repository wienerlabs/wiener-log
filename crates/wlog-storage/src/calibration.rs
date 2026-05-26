use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;
use wlog_proto::{TaskId, WorkspaceId};

use crate::StorageError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Estimator {
    Human,
    Engine,
}

impl Estimator {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Human => "human",
            Self::Engine => "engine",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Estimation {
    pub id: Uuid,
    pub task_id: TaskId,
    pub estimator: Estimator,
    pub estimated_hours: f64,
    pub estimated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct Completion {
    pub id: Uuid,
    pub task_id: TaskId,
    pub actual_hours: f64,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct EstimationRepo {
    pool: PgPool,
}

impl EstimationRepo {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn record(
        &self,
        workspace_id: WorkspaceId,
        task_id: TaskId,
        estimator: Estimator,
        hours: f64,
    ) -> Result<Estimation, StorageError> {
        if hours <= 0.0 {
            return Err(StorageError::Invalid("hours must be positive".into()));
        }
        let row = sqlx::query_as::<_, (Uuid, Uuid, String, f64, DateTime<Utc>)>(
            "INSERT INTO estimations (workspace_id, task_id, estimator, estimated_hours) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, task_id, estimator, estimated_hours, estimated_at",
        )
        .bind(workspace_id.0)
        .bind(task_id.0)
        .bind(estimator.as_str())
        .bind(hours)
        .fetch_one(&self.pool)
        .await?;
        Ok(Estimation {
            id: row.0,
            task_id: TaskId(row.1),
            estimator: if row.2 == "human" {
                Estimator::Human
            } else {
                Estimator::Engine
            },
            estimated_hours: row.3,
            estimated_at: row.4,
        })
    }

    pub async fn for_task(&self, task: TaskId) -> Result<Vec<Estimation>, StorageError> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, String, f64, DateTime<Utc>)>(
            "SELECT id, task_id, estimator, estimated_hours, estimated_at \
             FROM estimations WHERE task_id = $1 ORDER BY estimated_at ASC",
        )
        .bind(task.0)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| Estimation {
                id: r.0,
                task_id: TaskId(r.1),
                estimator: if r.2 == "human" {
                    Estimator::Human
                } else {
                    Estimator::Engine
                },
                estimated_hours: r.3,
                estimated_at: r.4,
            })
            .collect())
    }
}

#[derive(Debug, Clone)]
pub struct CompletionRepo {
    pool: PgPool,
}

impl CompletionRepo {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn record(
        &self,
        workspace_id: WorkspaceId,
        task_id: TaskId,
        actual_hours: f64,
    ) -> Result<Completion, StorageError> {
        if actual_hours <= 0.0 {
            return Err(StorageError::Invalid("hours must be positive".into()));
        }
        let row = sqlx::query_as::<_, (Uuid, Uuid, f64, DateTime<Utc>)>(
            "INSERT INTO completions (workspace_id, task_id, actual_hours) \
             VALUES ($1, $2, $3) \
             ON CONFLICT (task_id) DO UPDATE SET actual_hours = EXCLUDED.actual_hours, completed_at = now() \
             RETURNING id, task_id, actual_hours, completed_at",
        )
        .bind(workspace_id.0)
        .bind(task_id.0)
        .bind(actual_hours)
        .fetch_one(&self.pool)
        .await?;
        Ok(Completion {
            id: row.0,
            task_id: TaskId(row.1),
            actual_hours: row.2,
            completed_at: row.3,
        })
    }

    pub async fn for_workspace(
        &self,
        workspace_id: WorkspaceId,
        limit: i64,
    ) -> Result<Vec<Completion>, StorageError> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, f64, DateTime<Utc>)>(
            "SELECT id, task_id, actual_hours, completed_at \
             FROM completions WHERE workspace_id = $1 ORDER BY completed_at DESC LIMIT $2",
        )
        .bind(workspace_id.0)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| Completion {
                id: r.0,
                task_id: TaskId(r.1),
                actual_hours: r.2,
                completed_at: r.3,
            })
            .collect())
    }
}
