//! Task repository.

use chrono::{DateTime, Utc};
use sqlx::{AssertSqlSafe, PgPool, QueryBuilder};
use wlog_proto::{NodeType, TaskId, TaskNode, TaskStatus, UserId, WorkspaceId};

use crate::StorageError;
use crate::db_types::{DbNodeType, parse_status};

/// Input for creating a task.
#[derive(Debug, Clone)]
pub struct NewTask {
    /// Owning workspace.
    pub workspace_id: WorkspaceId,
    /// Where the node sits in the lifecycle.
    pub node_type: NodeType,
    /// Short title (1..=280 chars).
    pub title: String,
    /// Optional long-form body.
    pub body: Option<String>,
    /// Optional repository slug.
    pub repo: Option<String>,
    /// Optional owner.
    pub owner: Option<UserId>,
    /// Initial status; defaults to `proposed` if `None`.
    pub status: Option<TaskStatus>,
}

/// Filter for listing tasks.
#[derive(Debug, Clone, Default)]
pub struct TaskListFilter {
    /// Restrict to a single status.
    pub status: Option<TaskStatus>,
    /// Restrict to a single repository.
    pub repo: Option<String>,
    /// Restrict to a single owner.
    pub owner: Option<UserId>,
    /// Maximum rows returned (defaults to 50).
    pub limit: Option<i64>,
}

/// Typed access to the `tasks` table.
#[derive(Debug, Clone)]
pub struct TaskRepo {
    pool: PgPool,
}

#[derive(sqlx::FromRow)]
struct TaskRow {
    id: uuid::Uuid,
    workspace_id: uuid::Uuid,
    node_type: DbNodeType,
    title: String,
    body: Option<String>,
    repo: Option<String>,
    owner_user_id: Option<uuid::Uuid>,
    status: String,
    embedding_present: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TaskRow {
    fn into_node(self) -> Result<TaskNode, StorageError> {
        Ok(TaskNode {
            id: TaskId(self.id),
            workspace_id: WorkspaceId(self.workspace_id),
            node_type: self.node_type.into(),
            title: self.title,
            body: self.body,
            repo: self.repo,
            owner: self.owner_user_id.map(UserId),
            status: parse_status(&self.status)?,
            embedding_present: self.embedding_present,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

/// Columns shared between SELECT, INSERT RETURNING, and UPDATE RETURNING.
const TASK_COLUMNS: &str = "id, workspace_id, node_type, title, body, repo, owner_user_id, \
    status, (embedding IS NOT NULL) AS embedding_present, created_at, updated_at";

/// Full SELECT prefix for read paths.
const SELECT_TASK: &str = "SELECT id, workspace_id, node_type, title, body, repo, owner_user_id, \
    status, (embedding IS NOT NULL) AS embedding_present, created_at, updated_at \
    FROM tasks";

impl TaskRepo {
    /// Wrap a pool for task queries.
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Insert a task and return the persisted node.
    pub async fn create(&self, input: NewTask) -> Result<TaskNode, StorageError> {
        if input.title.is_empty() || input.title.len() > 280 {
            return Err(StorageError::Invalid(
                "title must be 1..=280 characters".into(),
            ));
        }
        let status = input.status.unwrap_or(TaskStatus::Proposed);
        let row: TaskRow = sqlx::query_as(
            "INSERT INTO tasks (workspace_id, node_type, title, body, repo, owner_user_id, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING id, workspace_id, node_type, title, body, repo, owner_user_id, \
             status, (embedding IS NOT NULL) AS embedding_present, created_at, updated_at",
        )
        .bind(input.workspace_id.0)
        .bind(DbNodeType::from(input.node_type))
        .bind(&input.title)
        .bind(input.body.as_deref())
        .bind(input.repo.as_deref())
        .bind(input.owner.map(|u| u.0))
        .bind(status.as_str())
        .fetch_one(&self.pool)
        .await?;
        row.into_node()
    }

    /// Fetch by primary key.
    pub async fn get(&self, id: TaskId) -> Result<TaskNode, StorageError> {
        // The SQL is built from compile-time constants only, so wrapping
        // in `AssertSqlSafe` is sound. sqlx 0.9 demands the assertion to
        // discourage accidental dynamic SQL.
        let sql = format!("{SELECT_TASK} WHERE id = $1");
        let row: TaskRow = sqlx::query_as(AssertSqlSafe(sql))
            .bind(id.0)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(StorageError::NotFound)?;
        row.into_node()
    }

    /// Find task IDs whose UUID begins with the supplied lowercase-hex
    /// prefix (>=8 chars). Returns at most `cap` rows; callers use this
    /// to resolve short identifiers shown in CLI listings.
    pub async fn resolve_short(
        &self,
        workspace_id: WorkspaceId,
        prefix: &str,
        cap: i64,
    ) -> Result<Vec<TaskId>, StorageError> {
        if prefix.len() < 8 || !prefix.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(StorageError::Invalid(
                "id prefix must be >=8 hex chars".into(),
            ));
        }
        let like = format!("{}%", prefix.to_ascii_lowercase());
        let rows: Vec<(uuid::Uuid,)> = sqlx::query_as(
            "SELECT id FROM tasks \
             WHERE workspace_id = $1 AND replace(id::text, '-', '') LIKE $2 \
             LIMIT $3",
        )
        .bind(workspace_id.0)
        .bind(like)
        .bind(cap)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(|(u,)| TaskId(u)).collect())
    }

    /// List tasks for a workspace, optionally filtered.
    pub async fn list(
        &self,
        workspace_id: WorkspaceId,
        filter: TaskListFilter,
    ) -> Result<Vec<TaskNode>, StorageError> {
        let mut qb: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(SELECT_TASK);
        qb.push(" WHERE workspace_id = ").push_bind(workspace_id.0);
        if let Some(status) = filter.status {
            qb.push(" AND status = ").push_bind(status.as_str());
        }
        if let Some(repo) = filter.repo.as_deref() {
            qb.push(" AND repo = ").push_bind(repo);
        }
        if let Some(owner) = filter.owner {
            qb.push(" AND owner_user_id = ").push_bind(owner.0);
        }
        qb.push(" ORDER BY updated_at DESC, id ASC LIMIT ")
            .push_bind(filter.limit.unwrap_or(50));
        let rows = qb.build_query_as::<TaskRow>().fetch_all(&self.pool).await?;
        rows.into_iter().map(TaskRow::into_node).collect()
    }

    /// Transition status. Validates the transition before issuing the
    /// UPDATE.
    pub async fn set_status(
        &self,
        id: TaskId,
        new_status: TaskStatus,
    ) -> Result<TaskNode, StorageError> {
        let current = self.get(id).await?;
        if current.status != new_status && !current.status.can_transition_to(new_status) {
            return Err(StorageError::Invalid(format!(
                "illegal status transition: {} -> {}",
                current.status.as_str(),
                new_status.as_str()
            )));
        }
        let sql = format!("UPDATE tasks SET status = $1 WHERE id = $2 RETURNING {TASK_COLUMNS}");
        let row: TaskRow = sqlx::query_as(AssertSqlSafe(sql))
            .bind(new_status.as_str())
            .bind(id.0)
            .fetch_one(&self.pool)
            .await?;
        row.into_node()
    }

    /// Replace title and body atomically. Used by `wlog ack --edit`.
    pub async fn update_text(
        &self,
        id: TaskId,
        title: &str,
        body: Option<&str>,
    ) -> Result<TaskNode, StorageError> {
        if title.is_empty() || title.len() > 280 {
            return Err(StorageError::Invalid(
                "title must be 1..=280 characters".into(),
            ));
        }
        let sql = format!(
            "UPDATE tasks SET title = $1, body = $2 WHERE id = $3 RETURNING {TASK_COLUMNS}"
        );
        let row: TaskRow = sqlx::query_as(AssertSqlSafe(sql))
            .bind(title)
            .bind(body)
            .bind(id.0)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(StorageError::NotFound)?;
        row.into_node()
    }
}
