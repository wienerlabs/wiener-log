#![allow(missing_docs)]

use std::sync::Arc;

use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use wlog_proto::{TaskId, TaskStatus};
use wlog_storage::{TaskListFilter, TaskRepo, WorkspaceRepo};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub struct AppState {
    pub pool: PgPool,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/workspaces", get(list_workspaces))
        .route("/workspaces/:slug/tasks", get(list_tasks))
        .route("/workspaces/:slug/tasks/:id", get(get_task))
        .with_state(state)
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let ok = sqlx::query("SELECT 1").execute(&state.pool).await.is_ok();
    let body = HealthResponse {
        status: if ok { "ok" } else { "degraded" },
        version: VERSION,
    };
    if ok {
        (StatusCode::OK, Json(body)).into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
    }
}

#[derive(Serialize)]
struct WorkspaceListItem {
    id: String,
    slug: String,
    name: String,
}

async fn list_workspaces(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let repo = WorkspaceRepo::new(state.pool.clone());
    match repo.list(100).await {
        Ok(rows) => {
            let body: Vec<_> = rows
                .into_iter()
                .map(|w| WorkspaceListItem {
                    id: w.id.0.to_string(),
                    slug: w.slug,
                    name: w.name,
                })
                .collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(e) => {
            tracing::warn!(error = %e, "list_workspaces failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

#[derive(Deserialize)]
struct TaskListQuery {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    repo: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_limit() -> i64 {
    50
}

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    Query(q): Query<TaskListQuery>,
) -> impl IntoResponse {
    let workspaces = WorkspaceRepo::new(state.pool.clone());
    let workspace = match workspaces.get_by_slug(&slug).await {
        Ok(w) => w,
        Err(wlog_storage::StorageError::NotFound) => {
            return (StatusCode::NOT_FOUND, "workspace not found").into_response();
        }
        Err(e) => {
            tracing::warn!(error = %e, "list_tasks workspace lookup");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let status = match q.status.as_deref() {
        Some(s) => match TaskStatus::parse(s) {
            Some(parsed) => Some(parsed),
            None => return (StatusCode::BAD_REQUEST, "unknown status").into_response(),
        },
        None => None,
    };
    let tasks = TaskRepo::new(state.pool.clone());
    let rows = match tasks
        .list(
            workspace.id,
            TaskListFilter {
                status,
                repo: q.repo,
                owner: None,
                limit: Some(q.limit),
            },
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "list_tasks query");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    (StatusCode::OK, Json(rows)).into_response()
}

async fn get_task(
    State(state): State<Arc<AppState>>,
    Path((_slug, id)): Path<(String, String)>,
) -> impl IntoResponse {
    let uuid = match uuid::Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid uuid").into_response(),
    };
    let tasks = TaskRepo::new(state.pool.clone());
    match tasks.get(TaskId(uuid)).await {
        Ok(t) => (StatusCode::OK, Json(t)).into_response(),
        Err(wlog_storage::StorageError::NotFound) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            tracing::warn!(error = %e, "get_task");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
