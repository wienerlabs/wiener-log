use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;
use wlog_storage::{StorageConfig, connect};

#[derive(Debug, Parser)]
#[command(name = "wlog-web", version, about = "WienerLog read-only web API")]
struct Args {
    #[arg(long, env = "WLOG_WEB_LISTEN", default_value = "127.0.0.1:8088")]
    listen: String,
    #[arg(
        long,
        env = "WLOG_DATABASE_URL",
        default_value = "postgres://wlog:wlog@localhost:5435/wlog"
    )]
    database_url: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .init();
    let args = Args::parse();
    let pool = connect(&StorageConfig {
        url: args.database_url,
        max_connections: 8,
    })
    .await?;
    let state = Arc::new(wlog_web::AppState { pool });
    let listener = TcpListener::bind(&args.listen).await?;
    tracing::info!(listen = %args.listen, "wlog-web listening");
    axum::serve(listener, wlog_web::router(state)).await?;
    Ok(())
}
