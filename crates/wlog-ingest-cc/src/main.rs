//! `wlog-ingest-cc` probe entry point. Phase 1 wires the watcher loop.

use anyhow::Result;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(
    name = "wlog-ingest-cc",
    version,
    about = "WienerLog Claude Code probe"
)]
struct Args {}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_target(false).init();
    let _args = Args::parse();
    tracing::info!(
        version = wlog_ingest_cc::VERSION,
        "wlog-ingest-cc probe (scaffold)"
    );
    Ok(())
}
