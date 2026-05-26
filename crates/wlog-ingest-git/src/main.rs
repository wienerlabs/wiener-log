//! `wlog-ingest-git` daemon entry point. Phase 1 wires the actual loop.

use anyhow::Result;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(
    name = "wlog-ingest-git",
    version,
    about = "WienerLog git event publisher"
)]
struct Args {}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_target(false).init();
    let _args = Args::parse();
    tracing::info!(
        version = wlog_ingest_git::VERSION,
        "wlog-ingest-git daemon (scaffold)"
    );
    Ok(())
}
