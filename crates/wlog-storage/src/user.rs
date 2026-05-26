//! User repository.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use wlog_proto::{UserId, WorkspaceId};

use crate::StorageError;

/// Input for creating a user inside a workspace.
#[derive(Debug, Clone)]
pub struct NewUser {
    /// Owning workspace.
    pub workspace_id: WorkspaceId,
    /// Per-workspace handle (unique within the workspace).
    pub handle: String,
    /// Optional email address.
    pub email: Option<String>,
}

/// A user row.
#[derive(Debug, Clone)]
pub struct User {
    /// Primary key.
    pub id: UserId,
    /// Owning workspace.
    pub workspace_id: WorkspaceId,
    /// Per-workspace handle.
    pub handle: String,
    /// Optional email.
    pub email: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Typed access to the `users` table.
#[derive(Debug, Clone)]
pub struct UserRepo {
    pool: PgPool,
}

impl UserRepo {
    /// Wrap a pool for user queries.
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create a new user and return the inserted row.
    pub async fn create(&self, input: NewUser) -> Result<User, StorageError> {
        if input.handle.trim().is_empty() {
            return Err(StorageError::Invalid("handle cannot be empty".into()));
        }
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                uuid::Uuid,
                String,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "INSERT INTO users (workspace_id, handle, email) VALUES ($1, $2, $3) \
             RETURNING id, workspace_id, handle, email, created_at",
        )
        .bind(input.workspace_id.0)
        .bind(&input.handle)
        .bind(input.email.as_deref())
        .fetch_one(&self.pool)
        .await?;
        Ok(User {
            id: UserId(row.0),
            workspace_id: WorkspaceId(row.1),
            handle: row.2,
            email: row.3,
            created_at: row.4,
        })
    }

    /// Fetch by primary key.
    pub async fn get(&self, id: UserId) -> Result<User, StorageError> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                uuid::Uuid,
                String,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, workspace_id, handle, email, created_at FROM users WHERE id = $1"
        )
        .bind(id.0)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(StorageError::NotFound)?;
        Ok(User {
            id: UserId(row.0),
            workspace_id: WorkspaceId(row.1),
            handle: row.2,
            email: row.3,
            created_at: row.4,
        })
    }

    /// Fetch by `(workspace_id, handle)`.
    pub async fn get_by_handle(
        &self,
        workspace_id: WorkspaceId,
        handle: &str,
    ) -> Result<User, StorageError> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                uuid::Uuid,
                String,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, workspace_id, handle, email, created_at \
             FROM users WHERE workspace_id = $1 AND handle = $2",
        )
        .bind(workspace_id.0)
        .bind(handle)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(StorageError::NotFound)?;
        Ok(User {
            id: UserId(row.0),
            workspace_id: WorkspaceId(row.1),
            handle: row.2,
            email: row.3,
            created_at: row.4,
        })
    }

    /// List users in a workspace.
    pub async fn list(
        &self,
        workspace_id: WorkspaceId,
        limit: i64,
    ) -> Result<Vec<User>, StorageError> {
        let rows = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                uuid::Uuid,
                String,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, workspace_id, handle, email, created_at \
                 FROM users WHERE workspace_id = $1 ORDER BY handle ASC LIMIT $2",
        )
        .bind(workspace_id.0)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| User {
                id: UserId(row.0),
                workspace_id: WorkspaceId(row.1),
                handle: row.2,
                email: row.3,
                created_at: row.4,
            })
            .collect())
    }

    /// List every user across every workspace, ordered by created_at
    /// descending. Used by the operator-facing `wlog admin users` view.
    pub async fn list_all(&self, limit: i64) -> Result<Vec<User>, StorageError> {
        let rows = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                uuid::Uuid,
                String,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            "SELECT id, workspace_id, handle, email, created_at \
                 FROM users ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| User {
                id: UserId(row.0),
                workspace_id: WorkspaceId(row.1),
                handle: row.2,
                email: row.3,
                created_at: row.4,
            })
            .collect())
    }
}
