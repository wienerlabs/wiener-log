//! Workspace repository.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use wlog_proto::WorkspaceId;

use crate::StorageError;

/// Input for creating a new workspace.
#[derive(Debug, Clone)]
pub struct NewWorkspace {
    /// URL-safe slug (lowercase, hyphens; 2..=40 chars).
    pub slug: String,
    /// Human-readable name.
    pub name: String,
}

/// A workspace row.
#[derive(Debug, Clone)]
pub struct Workspace {
    /// Primary key.
    pub id: WorkspaceId,
    /// URL-safe slug.
    pub slug: String,
    /// Human-readable name.
    pub name: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last mutation timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Typed access to the `workspaces` table.
#[derive(Debug, Clone)]
pub struct WorkspaceRepo {
    pool: PgPool,
}

impl WorkspaceRepo {
    /// Wrap a pool for workspace queries.
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Borrow the underlying pool.
    pub const fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Create a new workspace and return the inserted row.
    pub async fn create(&self, input: NewWorkspace) -> Result<Workspace, StorageError> {
        validate_slug(&input.slug)?;
        if input.name.trim().is_empty() {
            return Err(StorageError::Invalid("name cannot be empty".into()));
        }
        let row = sqlx::query_as::<_, (uuid::Uuid, String, String, DateTime<Utc>, DateTime<Utc>)>(
            "INSERT INTO workspaces (slug, name) VALUES ($1, $2) \
             RETURNING id, slug, name, created_at, updated_at",
        )
        .bind(&input.slug)
        .bind(&input.name)
        .fetch_one(&self.pool)
        .await?;
        Ok(Workspace {
            id: WorkspaceId(row.0),
            slug: row.1,
            name: row.2,
            created_at: row.3,
            updated_at: row.4,
        })
    }

    /// Fetch by primary key.
    pub async fn get(&self, id: WorkspaceId) -> Result<Workspace, StorageError> {
        let row = sqlx::query_as::<_, (uuid::Uuid, String, String, DateTime<Utc>, DateTime<Utc>)>(
            "SELECT id, slug, name, created_at, updated_at FROM workspaces WHERE id = $1",
        )
        .bind(id.0)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(StorageError::NotFound)?;
        Ok(Workspace {
            id: WorkspaceId(row.0),
            slug: row.1,
            name: row.2,
            created_at: row.3,
            updated_at: row.4,
        })
    }

    /// Fetch by slug.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Workspace, StorageError> {
        let row = sqlx::query_as::<_, (uuid::Uuid, String, String, DateTime<Utc>, DateTime<Utc>)>(
            "SELECT id, slug, name, created_at, updated_at FROM workspaces WHERE slug = $1",
        )
        .bind(slug)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(StorageError::NotFound)?;
        Ok(Workspace {
            id: WorkspaceId(row.0),
            slug: row.1,
            name: row.2,
            created_at: row.3,
            updated_at: row.4,
        })
    }

    /// List workspaces, ordered by slug.
    pub async fn list(&self, limit: i64) -> Result<Vec<Workspace>, StorageError> {
        let rows = sqlx::query_as::<_, (uuid::Uuid, String, String, DateTime<Utc>, DateTime<Utc>)>(
            "SELECT id, slug, name, created_at, updated_at FROM workspaces \
                 ORDER BY slug ASC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| Workspace {
                id: WorkspaceId(row.0),
                slug: row.1,
                name: row.2,
                created_at: row.3,
                updated_at: row.4,
            })
            .collect())
    }
}

/// Slug rules match the CHECK constraint on the workspaces table.
fn validate_slug(slug: &str) -> Result<(), StorageError> {
    if slug.len() < 2 || slug.len() > 40 {
        return Err(StorageError::Invalid(
            "slug must be 2..=40 characters".into(),
        ));
    }
    let bytes = slug.as_bytes();
    if !bytes[0].is_ascii_alphanumeric() || !bytes[bytes.len() - 1].is_ascii_alphanumeric() {
        return Err(StorageError::Invalid(
            "slug must start and end with [a-z0-9]".into(),
        ));
    }
    for &b in bytes {
        let ok = b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-';
        if !ok {
            return Err(StorageError::Invalid("slug must match [a-z0-9-]+".into()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_validation_rejects_uppercase() {
        assert!(validate_slug("Wienerlog").is_err());
    }

    #[test]
    fn slug_validation_accepts_typical() {
        assert!(validate_slug("wienerlog").is_ok());
        assert!(validate_slug("my-team-2").is_ok());
    }

    #[test]
    fn slug_validation_rejects_leading_hyphen() {
        assert!(validate_slug("-foo").is_err());
    }

    #[test]
    fn slug_validation_rejects_too_short() {
        assert!(validate_slug("a").is_err());
    }
}
