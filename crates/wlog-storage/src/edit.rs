use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;
use wlog_proto::{TaskId, UserId, WorkspaceId};

use crate::StorageError;

#[derive(Debug, Clone)]
pub struct NewTaskEdit {
    pub workspace_id: WorkspaceId,
    pub task_id: TaskId,
    pub editor: Option<UserId>,
    pub field: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TaskEdit {
    pub id: Uuid,
    pub task_id: TaskId,
    pub editor: Option<UserId>,
    pub field: String,
    pub before: Option<String>,
    pub after: Option<String>,
    pub edited_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct TaskEditRepo {
    pool: PgPool,
}

impl TaskEditRepo {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, input: NewTaskEdit) -> Result<TaskEdit, StorageError> {
        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                String,
                Option<String>,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "INSERT INTO task_edits (workspace_id, task_id, editor_user_id, field, before, after) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, task_id, editor_user_id, field, before, after, edited_at",
        )
        .bind(input.workspace_id.0)
        .bind(input.task_id.0)
        .bind(input.editor.map(|u| u.0))
        .bind(&input.field)
        .bind(input.before.as_deref())
        .bind(input.after.as_deref())
        .fetch_one(&self.pool)
        .await?;
        Ok(TaskEdit {
            id: row.0,
            task_id: TaskId(row.1),
            editor: row.2.map(UserId),
            field: row.3,
            before: row.4,
            after: row.5,
            edited_at: row.6,
        })
    }

    pub async fn for_task(&self, task: TaskId) -> Result<Vec<TaskEdit>, StorageError> {
        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                String,
                Option<String>,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, task_id, editor_user_id, field, before, after, edited_at \
             FROM task_edits WHERE task_id = $1 ORDER BY edited_at ASC",
        )
        .bind(task.0)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| TaskEdit {
                id: r.0,
                task_id: TaskId(r.1),
                editor: r.2.map(UserId),
                field: r.3,
                before: r.4,
                after: r.5,
                edited_at: r.6,
            })
            .collect())
    }
}
