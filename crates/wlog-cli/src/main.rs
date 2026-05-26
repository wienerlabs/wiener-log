//! `wlog` command line entry point.
//!
//! Phase -1 ships only the subcommand surface so that CI can verify the
//! binary builds. Each subcommand is implemented incrementally in Phase 0.

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

#[derive(Debug, Parser)]
#[command(
    name = "wlog",
    version,
    about = "WienerLog command line interface",
    long_about = "Activity-aware task synthesis. Observes git, Claude Code, and GitHub, \
                  then proposes task nodes for human review."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Bootstrap a workspace: write config, verify database connection.
    Init {
        /// Workspace slug.
        #[arg(long)]
        slug: Option<String>,
    },
    /// Add a manual task.
    Add {
        /// Task title.
        title: String,
    },
    /// List tasks, optionally filtered.
    Ls {
        /// Filter by status.
        #[arg(long)]
        status: Option<String>,
    },
    /// Show a task and its edges.
    Show {
        /// Task identifier.
        id: String,
    },
    /// Acknowledge a proposed task.
    Ack {
        /// Task identifier.
        id: String,
        /// Open editor to edit before ack.
        #[arg(long)]
        edit: bool,
    },
    /// Render the synthesized morning standup.
    Daily,
    /// Semantic search across tasks.
    Search {
        /// Query string.
        query: String,
    },
    /// Why does this task exist? Walk provenance chain.
    Why {
        /// Task identifier.
        id: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();
    match cli.command {
        Command::Init { slug } => {
            tracing::info!(?slug, "init invoked; implementation arrives in Phase 0");
            println!("wlog init: scaffolding deferred to Phase 0");
        }
        Command::Add { title } => {
            tracing::info!(%title, "add invoked; implementation arrives in Phase 0");
            println!("wlog add: deferred to Phase 0");
        }
        Command::Ls { status } => {
            tracing::info!(?status, "ls invoked; implementation arrives in Phase 0");
            println!("wlog ls: deferred to Phase 0");
        }
        Command::Show { id } => {
            tracing::info!(%id, "show invoked; implementation arrives in Phase 0");
            println!("wlog show: deferred to Phase 0");
        }
        Command::Ack { id, edit } => {
            tracing::info!(%id, edit, "ack invoked; implementation arrives in Phase 0");
            println!("wlog ack: deferred to Phase 0");
        }
        Command::Daily => {
            tracing::info!("daily invoked; implementation arrives in Phase 1");
            println!("wlog daily: deferred to Phase 1");
        }
        Command::Search { query } => {
            tracing::info!(%query, "search invoked; implementation arrives in Phase 1");
            println!("wlog search: deferred to Phase 1");
        }
        Command::Why { id } => {
            tracing::info!(%id, "why invoked; implementation arrives in Phase 1");
            println!("wlog why: deferred to Phase 1");
        }
    }
    Ok(())
}
