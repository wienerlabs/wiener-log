//! `wlog-ingest-gh` webhook receiver entry point. Phase 1 wires the router.

use anyhow::Result;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(
    name = "wlog-ingest-gh",
    version,
    about = "WienerLog GitHub webhook receiver"
)]
struct Args {
    /// Listen address.
    #[arg(long, env = "WLOG_GH_LISTEN", default_value = "127.0.0.1:8787")]
    listen: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_target(false).init();
    let args = Args::parse();
    tracing::info!(version = wlog_ingest_gh::VERSION, listen = %args.listen, "wlog-ingest-gh (scaffold)");
    Ok(())
}
