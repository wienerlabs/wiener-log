#![allow(missing_docs)]

use std::fmt::Write as _;
use std::sync::Arc;

use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse};
use axum::routing::get;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use wlog_proto::{TaskId, TaskStatus};
use wlog_storage::{
    EdgeRepo, EventRepo, TaskListFilter, TaskRepo, WorkspaceRepo, event_source_str,
};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub struct AppState {
    pub pool: PgPool,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        // HTML dashboard
        .route("/", get(html_index))
        .route("/w/:slug", get(html_workspace))
        .route("/w/:slug/t/:id", get(html_task))
        .route("/static/style.css", get(static_css))
        // JSON API
        .route("/health", get(health))
        .route("/workspaces", get(list_workspaces))
        .route("/workspaces/:slug/tasks", get(list_tasks))
        .route("/workspaces/:slug/tasks/:id", get(get_task))
        .with_state(state)
}

// ---------------------------------------------------------------- /health

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

// ---------------------------------------------------------------- JSON API

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

const fn default_limit() -> i64 {
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

// ---------------------------------------------------------------- HTML helpers

const STYLE_CSS: &str = include_str!("style.css");

async fn static_css() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/css; charset=utf-8")],
        STYLE_CSS,
    )
}

fn html_chrome(title: &str, body: &str, breadcrumb: &str) -> String {
    let head = format!(
        "<!doctype html>\n\
         <html lang=\"en\">\n\
         <head>\n\
         <meta charset=\"utf-8\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
         <title>{title} · WienerLog</title>\n\
         <link rel=\"stylesheet\" href=\"/static/style.css\">\n\
         </head>\n\
         <body>\n\
         <header class=\"hdr\">\n\
         <a class=\"brand\" href=\"/\">WIENER LABS · wlog</a>\n\
         <nav class=\"crumb\">{breadcrumb}</nav>\n\
         </header>\n\
         <main>\n"
    );
    let foot = format!(
        "\n</main>\n\
         <footer><small>WienerLog v{VERSION} · <a href=\"/health\">/health</a> · <a href=\"https://github.com/wienerlabs/wienerlog\">source</a></small></footer>\n\
         </body></html>\n"
    );
    head + body + &foot
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn status_pill(status: TaskStatus) -> String {
    let (label, class) = match status {
        TaskStatus::Proposed => ("proposed", "pill-proposed"),
        TaskStatus::Acked => ("acked", "pill-acked"),
        TaskStatus::InProgress => ("in-progress", "pill-progress"),
        TaskStatus::Done => ("done", "pill-done"),
        TaskStatus::Rejected => ("rejected", "pill-rejected"),
    };
    format!("<span class=\"pill {class}\">{label}</span>")
}

// ---------------------------------------------------------------- HTML routes

async fn html_index(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let workspaces_repo = WorkspaceRepo::new(state.pool.clone());
    let workspaces = workspaces_repo.list(200).await.unwrap_or_default();

    let mut rows = String::new();
    for w in &workspaces {
        let _ = write!(
            rows,
            "<tr><td><a href=\"/w/{slug}\">{slug}</a></td><td>{name}</td><td class=\"dim\">{when}</td></tr>",
            slug = esc(&w.slug),
            name = esc(&w.name),
            when = w.created_at.format("%Y-%m-%d"),
        );
    }

    let body = format!(
        "<h1>Workspaces</h1>\n\
         <p class=\"lede\">{count} workspaces tracked. Pick one to see proposed and acked tasks.</p>\n\
         <table class=\"data\">\n\
         <thead><tr><th>SLUG</th><th>NAME</th><th>CREATED</th></tr></thead>\n\
         <tbody>{rows}</tbody>\n\
         </table>",
        count = workspaces.len(),
    );

    Html(html_chrome("Workspaces", &body, "<span>workspaces</span>")).into_response()
}

async fn html_workspace(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let ws_repo = WorkspaceRepo::new(state.pool.clone());
    let workspace = match ws_repo.get_by_slug(&slug).await {
        Ok(w) => w,
        Err(wlog_storage::StorageError::NotFound) => {
            return (
                StatusCode::NOT_FOUND,
                Html(html_chrome(
                    "Not found",
                    "<h1>Workspace not found</h1>",
                    "<a href=\"/\">workspaces</a> · <span>?</span>",
                )),
            )
                .into_response();
        }
        Err(e) => {
            tracing::warn!(error = %e, "html_workspace");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let tasks_repo = TaskRepo::new(state.pool.clone());
    let tasks = tasks_repo
        .list(
            workspace.id,
            TaskListFilter {
                status: None,
                repo: None,
                owner: None,
                limit: Some(100),
            },
        )
        .await
        .unwrap_or_default();

    let events_repo = EventRepo::new(state.pool.clone());
    let recent_events = events_repo
        .list_recent(Some(workspace.id), 10)
        .await
        .unwrap_or_default();

    let mut task_rows = String::new();
    for t in &tasks {
        let _ = write!(
            task_rows,
            "<tr><td><a href=\"/w/{slug}/t/{id}\">{short}</a></td><td>{pill}</td><td>{title}</td><td class=\"dim\">{repo}</td><td class=\"dim\">{when}</td></tr>",
            slug = esc(&workspace.slug),
            id = t.id.0,
            short = t.id.short(),
            pill = status_pill(t.status),
            title = esc(&t.title),
            repo = esc(t.repo.as_deref().unwrap_or("-")),
            when = t.created_at.format("%Y-%m-%d %H:%M"),
        );
    }

    let mut event_rows = String::new();
    for e in &recent_events {
        let _ = write!(
            event_rows,
            "<tr><td class=\"dim\">{when}</td><td><code>{src}.{kind}</code></td></tr>",
            when = e.occurred_at.format("%H:%M:%S"),
            src = esc(event_source_str(e.source)),
            kind = esc(e.kind.as_str()),
        );
    }

    let counts = count_statuses(&tasks);
    let body = format!(
        "<h1>{name} <small class=\"dim\">/{slug}</small></h1>\n\
         <section class=\"counts\">\n\
         <div><strong>{proposed}</strong><br><small>proposed</small></div>\n\
         <div><strong>{acked}</strong><br><small>acked</small></div>\n\
         <div><strong>{progress}</strong><br><small>in progress</small></div>\n\
         <div><strong>{done}</strong><br><small>done</small></div>\n\
         <div><strong>{rejected}</strong><br><small>rejected</small></div>\n\
         </section>\n\
         <h2>Tasks <small class=\"dim\">({total})</small></h2>\n\
         <table class=\"data\">\n\
         <thead><tr><th>ID</th><th>STATUS</th><th>TITLE</th><th>REPO</th><th>CREATED</th></tr></thead>\n\
         <tbody>{task_rows}</tbody>\n\
         </table>\n\
         <h2>Recent events <small class=\"dim\">(last 10)</small></h2>\n\
         <table class=\"data narrow\">\n\
         <thead><tr><th>TIME</th><th>SUBJECT</th></tr></thead>\n\
         <tbody>{event_rows}</tbody>\n\
         </table>",
        name = esc(&workspace.name),
        slug = esc(&workspace.slug),
        proposed = counts.proposed,
        acked = counts.acked,
        progress = counts.in_progress,
        done = counts.done,
        rejected = counts.rejected,
        total = tasks.len(),
    );

    let breadcrumb = format!(
        "<a href=\"/\">workspaces</a> · <span>{}</span>",
        esc(&workspace.slug)
    );
    Html(html_chrome(&workspace.name, &body, &breadcrumb)).into_response()
}

async fn html_task(
    State(state): State<Arc<AppState>>,
    Path((slug, id)): Path<(String, String)>,
) -> impl IntoResponse {
    let uuid = match uuid::Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Html(html_chrome(
                    "Bad id",
                    "<h1>Invalid task id</h1>",
                    "<a href=\"/\">workspaces</a>",
                )),
            )
                .into_response();
        }
    };
    let tasks_repo = TaskRepo::new(state.pool.clone());
    let task = match tasks_repo.get(TaskId(uuid)).await {
        Ok(t) => t,
        Err(wlog_storage::StorageError::NotFound) => {
            return (
                StatusCode::NOT_FOUND,
                Html(html_chrome(
                    "Not found",
                    "<h1>Task not found</h1>",
                    "<a href=\"/\">workspaces</a>",
                )),
            )
                .into_response();
        }
        Err(e) => {
            tracing::warn!(error = %e, "html_task");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let edges_repo = EdgeRepo::new(state.pool.clone());
    let outgoing = edges_repo.outgoing(task.id).await.unwrap_or_default();
    let incoming = edges_repo.incoming(task.id).await.unwrap_or_default();

    let body = format!(
        "<h1>{title}</h1>\n\
         <p>{pill} <code>{full_id}</code> · <span class=\"dim\">{node_type:?}</span></p>\n\
         <section class=\"meta\">\n\
         <div><strong>created</strong><br>{created}</div>\n\
         <div><strong>updated</strong><br>{updated}</div>\n\
         <div><strong>repo</strong><br>{repo}</div>\n\
         </section>\n\
         <article class=\"body\">{body_html}</article>\n\
         <h2>Edges</h2>\n\
         <p class=\"dim\">in: {n_in} · out: {n_out}</p>\n\
         <p><a href=\"/w/{slug}\">← back to workspace</a></p>",
        title = esc(&task.title),
        pill = status_pill(task.status),
        full_id = task.id.0,
        node_type = task.node_type,
        created = task.created_at.format("%Y-%m-%d %H:%M UTC"),
        updated = task.updated_at.format("%Y-%m-%d %H:%M UTC"),
        repo = esc(task.repo.as_deref().unwrap_or("-")),
        body_html = task.body.as_deref().map_or_else(
            || "<em class=\"dim\">(no body)</em>".to_string(),
            |b| format!("<pre>{}</pre>", esc(b)),
        ),
        n_in = incoming.len(),
        n_out = outgoing.len(),
        slug = esc(&slug),
    );

    let breadcrumb = format!(
        "<a href=\"/\">workspaces</a> · <a href=\"/w/{slug}\">{slug}</a> · <span>{short}</span>",
        slug = esc(&slug),
        short = task.id.short(),
    );
    Html(html_chrome(&task.title, &body, &breadcrumb)).into_response()
}

#[derive(Default)]
struct StatusCounts {
    proposed: usize,
    acked: usize,
    in_progress: usize,
    done: usize,
    rejected: usize,
}

fn count_statuses(tasks: &[wlog_proto::TaskNode]) -> StatusCounts {
    let mut counts = StatusCounts::default();
    for t in tasks {
        match t.status {
            TaskStatus::Proposed => counts.proposed += 1,
            TaskStatus::Acked => counts.acked += 1,
            TaskStatus::InProgress => counts.in_progress += 1,
            TaskStatus::Done => counts.done += 1,
            TaskStatus::Rejected => counts.rejected += 1,
        }
    }
    counts
}
