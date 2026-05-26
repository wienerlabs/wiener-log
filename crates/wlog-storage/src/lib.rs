//! WienerLog storage layer.
//!
//! Wraps `sqlx::PgPool` with typed repositories for events, tasks, and edges.
//! Phase 0 ships the connection bootstrap and migration runner; the
//! repositories are implemented incrementally per Phase 0 sprint backlog.

#![warn(missing_docs)]

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{Executor, PgPool};
use thiserror::Error;

/// Storage layer errors. Wraps `sqlx::Error` so callers do not depend on the
/// driver crate directly.
#[derive(Debug, Error)]
pub enum StorageError {
    /// Underlying database error.
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    /// Migration error.
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
}

/// Storage configuration. Constructed from `wlog.toml` or environment.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    /// Postgres connection URL (postgres://user:pass@host:port/db).
    pub url: String,
    /// Max pool size.
    pub max_connections: u32,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            url: "postgres://wlog:wlog@localhost:5432/wlog".to_string(),
            max_connections: 10,
        }
    }
}

/// Open a pool and run migrations.
pub async fn connect(config: &StorageConfig) -> Result<PgPool, StorageError> {
    let options: PgConnectOptions = config.url.parse()?;
    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .connect_with(options)
        .await?;
    Ok(pool)
}

/// Run pending migrations. Migrations live under `migrations/` in the
/// workspace root and are embedded into the binary at build time.
pub async fn migrate(pool: &PgPool) -> Result<(), StorageError> {
    sqlx::migrate!("../../migrations").run(pool).await?;
    Ok(())
}

/// Healthcheck: SELECT 1 against the pool.
pub async fn healthcheck(pool: &PgPool) -> Result<(), StorageError> {
    pool.execute("SELECT 1").await?;
    Ok(())
}
