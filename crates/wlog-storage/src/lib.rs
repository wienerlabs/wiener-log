//! WienerLog storage layer.
//!
//! Wraps `sqlx::PgPool` with typed repositories for workspaces, users,
//! tasks, edges, and events. Migrations live under `migrations/` and are
//! embedded into the binary at compile time.

#![allow(missing_docs)]

mod calibration;
mod db_types;
mod edge;
mod edit;
mod event;
mod task;
mod user;
mod workspace;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{Executor, PgPool};
use thiserror::Error;

pub use calibration::{Completion, CompletionRepo, Estimation, EstimationRepo, Estimator};
pub use edge::EdgeRepo;
pub use edit::{NewTaskEdit, TaskEdit, TaskEditRepo};
pub use event::EventRepo;
pub use task::{NewTask, TaskListFilter, TaskRepo};
pub use user::{NewUser, UserRepo};
pub use workspace::{NewWorkspace, WorkspaceRepo};

/// Storage layer errors.
#[derive(Debug, Error)]
pub enum StorageError {
    /// Row not found for the requested key.
    #[error("not found")]
    NotFound,
    /// Caller-supplied value violates a domain rule.
    #[error("invalid input: {0}")]
    Invalid(String),
    /// Unknown enum or status string returned by the database.
    #[error("unknown enum value: {0}")]
    UnknownEnum(String),
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
            url: "postgres://wlog:wlog@localhost:5435/wlog".to_string(),
            max_connections: 10,
        }
    }
}

/// Open a pool against the configured Postgres.
pub async fn connect(config: &StorageConfig) -> Result<PgPool, StorageError> {
    let options: PgConnectOptions = config.url.parse()?;
    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .connect_with(options)
        .await?;
    Ok(pool)
}

/// Run pending migrations.
pub async fn migrate(pool: &PgPool) -> Result<(), StorageError> {
    sqlx::migrate!("../../migrations").run(pool).await?;
    Ok(())
}

/// Healthcheck: SELECT 1 against the pool.
pub async fn healthcheck(pool: &PgPool) -> Result<(), StorageError> {
    pool.execute("SELECT 1").await?;
    Ok(())
}
