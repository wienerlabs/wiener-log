//! End-to-end integration test exercising the full storage layer against
//! a real Postgres container.
//!
//! Driven by `testcontainers` when Docker is available locally; in CI we
//! point `WLOG_TEST_DATABASE_URL` at the workflow's `postgres` service
//! instead so we do not spawn nested containers.

use anyhow::{Context, Result};
use std::time::Duration;
use testcontainers::core::{IntoContainerPort, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{GenericImage, ImageExt};
use wlog_proto::{NodeType, TaskStatus};
use wlog_storage::{
    EdgeRepo, NewTask, NewUser, NewWorkspace, StorageConfig, TaskListFilter, TaskRepo, UserRepo,
    WorkspaceRepo, connect, healthcheck, migrate,
};

async fn pool_for_test() -> Result<(
    sqlx::PgPool,
    Option<testcontainers::ContainerAsync<GenericImage>>,
)> {
    if let Ok(url) = std::env::var("WLOG_TEST_DATABASE_URL") {
        let pool = connect(&StorageConfig {
            url,
            max_connections: 4,
        })
        .await?;
        return Ok((pool, None));
    }
    let container = GenericImage::new("pgvector/pgvector", "pg16")
        .with_exposed_port(5432.tcp())
        .with_wait_for(WaitFor::message_on_stderr(
            "database system is ready to accept connections",
        ))
        .with_env_var("POSTGRES_USER", "wlog")
        .with_env_var("POSTGRES_PASSWORD", "wlog")
        .with_env_var("POSTGRES_DB", "wlog")
        .start()
        .await
        .context("starting postgres container")?;
    let host_port = container
        .get_host_port_ipv4(5432)
        .await
        .context("mapped port")?;
    // Give the server one beat after it announces readiness.
    tokio::time::sleep(Duration::from_millis(500)).await;
    let url = format!("postgres://wlog:wlog@127.0.0.1:{host_port}/wlog");
    let pool = connect(&StorageConfig {
        url,
        max_connections: 4,
    })
    .await?;
    Ok((pool, Some(container)))
}

#[tokio::test]
#[ignore = "needs docker or WLOG_TEST_DATABASE_URL"]
async fn full_cli_flow_against_postgres() -> Result<()> {
    let (pool, _guard) = pool_for_test().await?;
    migrate(&pool).await?;
    healthcheck(&pool).await?;

    // Slug is unique-constrained, so use a fresh suffix per run when the DB
    // is shared (CI Postgres service). Testcontainers gives a fresh DB so
    // this also works there.
    let slug_suffix: String = uuid::Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect();
    let slug = format!("e2e-{slug_suffix}");
    let workspaces = WorkspaceRepo::new(pool.clone());
    let ws = workspaces
        .create(NewWorkspace {
            slug: slug.clone(),
            name: "End to End".into(),
        })
        .await?;
    assert_eq!(ws.slug, slug);

    let users = UserRepo::new(pool.clone());
    let user = users
        .create(NewUser {
            workspace_id: ws.id,
            handle: "tester".into(),
            email: None,
        })
        .await?;

    let tasks = TaskRepo::new(pool.clone());
    let proposed = tasks
        .create(NewTask {
            workspace_id: ws.id,
            node_type: NodeType::Intent,
            title: "first proposal".into(),
            body: Some("body".into()),
            repo: Some("aperture".into()),
            owner: Some(user.id),
            status: None,
        })
        .await?;
    assert_eq!(proposed.status, TaskStatus::Proposed);

    let listed = tasks.list(ws.id, TaskListFilter::default()).await?;
    assert_eq!(listed.len(), 1);

    let acked = tasks.set_status(proposed.id, TaskStatus::Acked).await?;
    assert_eq!(acked.status, TaskStatus::Acked);
    let rejected_attempt = tasks.set_status(proposed.id, TaskStatus::Proposed).await;
    assert!(
        rejected_attempt.is_err(),
        "illegal transition acked->proposed must be rejected"
    );

    let edited = tasks
        .update_text(proposed.id, "first proposal v2", Some("updated body"))
        .await?;
    assert_eq!(edited.title, "first proposal v2");

    let second = tasks
        .create(NewTask {
            workspace_id: ws.id,
            node_type: NodeType::Decomposition,
            title: "sub-task".into(),
            body: None,
            repo: Some("aperture".into()),
            owner: Some(user.id),
            status: Some(TaskStatus::Acked),
        })
        .await?;
    let edges = EdgeRepo::new(pool.clone());
    let edge = edges
        .create(
            ws.id,
            proposed.id,
            second.id,
            wlog_proto::EdgeType::DecomposesInto,
        )
        .await?;
    assert_eq!(edge.from_task.as_uuid(), proposed.id.as_uuid());

    let outgoing = edges.outgoing(proposed.id).await?;
    assert_eq!(outgoing.len(), 1);
    let incoming = edges.incoming(second.id).await?;
    assert_eq!(incoming.len(), 1);

    let only_decomp = tasks
        .list(
            ws.id,
            TaskListFilter {
                status: Some(TaskStatus::Acked),
                repo: Some("aperture".into()),
                owner: None,
                limit: Some(10),
            },
        )
        .await?;
    assert_eq!(only_decomp.len(), 2);

    Ok(())
}
