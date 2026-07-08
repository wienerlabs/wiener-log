//! Event repository (minimal Phase 0 surface; expanded in Phase 1).

use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;
use wlog_proto::{Event, EventKind, TaskId, WorkspaceId};

use crate::StorageError;
use crate::db_types::{event_source_str, parse_event_source};

/// Typed access to the `events` table.
#[derive(Debug, Clone)]
pub struct EventRepo {
    pool: PgPool,
}

impl EventRepo {
    /// Wrap a pool for event queries.
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Insert an event and return the persisted record.
    pub async fn create(&self, event: &Event) -> Result<Event, StorageError> {
        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                String,
                JsonValue,
                DateTime<Utc>,
                DateTime<Utc>,
                Option<Uuid>,
            ),
        >(
            "INSERT INTO events (id, workspace_id, source, kind, payload, occurred_at) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, workspace_id, source, kind, payload, occurred_at, ingested_at, task_id",
        )
        .bind(event.id)
        .bind(event.workspace_id.0)
        .bind(event_source_str(event.source))
        .bind(event.kind.as_str())
        .bind(&event.payload)
        .bind(event.occurred_at)
        .fetch_one(&self.pool)
        .await?;
        Ok(Event {
            id: row.0,
            workspace_id: WorkspaceId(row.1),
            source: parse_event_source(&row.2)?,
            kind: EventKind::new(row.3),
            payload: row.4,
            occurred_at: row.5,
        })
    }

    /// Link an existing event to a task.
    pub async fn link_to_task(&self, event_id: Uuid, task: TaskId) -> Result<(), StorageError> {
        let affected = sqlx::query("UPDATE events SET task_id = $1 WHERE id = $2")
            .bind(task.0)
            .bind(event_id)
            .execute(&self.pool)
            .await?
            .rows_affected();
        if affected == 0 {
            return Err(StorageError::NotFound);
        }
        Ok(())
    }

    /// Events linked to a given task, oldest first.
    pub async fn for_task(&self, task: TaskId) -> Result<Vec<Uuid>, StorageError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT id FROM events WHERE task_id = $1 ORDER BY occurred_at ASC")
                .bind(task.0)
                .fetch_all(&self.pool)
                .await?;
        Ok(rows.into_iter().map(|(u,)| u).collect())
    }

    /// Events ingested after `cursor`, oldest first, with each row's
    /// `ingested_at` so the caller can advance its cursor. Drives the
    /// `wlog engine run` poll loop.
    pub async fn list_since_ingested(
        &self,
        cursor: DateTime<Utc>,
        limit: i64,
    ) -> Result<Vec<(Event, DateTime<Utc>)>, StorageError> {
        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                String,
                JsonValue,
                DateTime<Utc>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, workspace_id, source, kind, payload, occurred_at, ingested_at \
             FROM events WHERE ingested_at > $1 ORDER BY ingested_at ASC LIMIT $2",
        )
        .bind(cursor)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            out.push((
                Event {
                    id: row.0,
                    workspace_id: WorkspaceId(row.1),
                    source: parse_event_source(&row.2)?,
                    kind: EventKind::new(row.3),
                    payload: row.4,
                    occurred_at: row.5,
                },
                row.6,
            ));
        }
        Ok(out)
    }

    /// Recent events, newest first. Optional workspace filter.
    /// Used by `wlog log` and `wlog admin replay`.
    pub async fn list_recent(
        &self,
        workspace: Option<WorkspaceId>,
        limit: i64,
    ) -> Result<Vec<Event>, StorageError> {
        let rows = if let Some(ws) = workspace {
            sqlx::query_as::<_, (Uuid, Uuid, String, String, JsonValue, DateTime<Utc>)>(
                "SELECT id, workspace_id, source, kind, payload, occurred_at \
                 FROM events WHERE workspace_id = $1 ORDER BY occurred_at DESC LIMIT $2",
            )
            .bind(ws.0)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, (Uuid, Uuid, String, String, JsonValue, DateTime<Utc>)>(
                "SELECT id, workspace_id, source, kind, payload, occurred_at \
                 FROM events ORDER BY occurred_at DESC LIMIT $1",
            )
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };

        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            out.push(Event {
                id: row.0,
                workspace_id: WorkspaceId(row.1),
                source: parse_event_source(&row.2)?,
                kind: EventKind::new(row.3),
                payload: row.4,
                occurred_at: row.5,
            });
        }
        Ok(out)
    }
}
