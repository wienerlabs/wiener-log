//! `wlog` command line entry point.

#![warn(missing_docs)]

use wlog_cli::{config, daemon, output};

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{Context, Result, anyhow};
use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::Shell;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;
use wlog_proto::{NodeType, TaskId, TaskStatus};
use wlog_storage::{
    EdgeRepo, NewTask, NewUser, NewWorkspace, StorageConfig, StorageError, TaskListFilter,
    TaskRepo, UserRepo, WorkspaceRepo, connect, healthcheck, migrate,
};

use self::config::{Config, ConfigError, StorageSection, WorkspaceConfig};
use self::output::Format;

#[derive(Debug, Parser)]
#[command(
    name = "wlog",
    version,
    about = "WienerLog command line interface",
    long_about = "Activity-aware task synthesis. The system watches; you confirm."
)]
struct Cli {
    /// Path to an explicit config file (overrides discovery).
    #[arg(long, global = true, env = "WLOG_CONFIG")]
    config: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Bootstrap a workspace: write config, run migrations, verify DB.
    Init {
        /// URL-safe slug, defaults to current directory name.
        #[arg(long)]
        slug: Option<String>,
        /// Human-readable name; defaults to the slug.
        #[arg(long)]
        name: Option<String>,
        /// Per-workspace handle for the current user.
        #[arg(long, default_value = "me")]
        user: String,
        /// Postgres URL.
        #[arg(
            long,
            env = "WLOG_DATABASE_URL",
            default_value = "postgres://wlog:wlog@localhost:5435/wlog"
        )]
        database_url: String,
        /// Overwrite an existing config.
        #[arg(long)]
        force: bool,
    },
    /// Add a manual task.
    Add {
        /// Task title.
        title: String,
        /// Optional body.
        #[arg(long)]
        body: Option<String>,
        /// Originating repository slug.
        #[arg(long)]
        repo: Option<String>,
        /// Node type (intent, decomposition, execution, outcome).
        #[arg(long, default_value = "intent")]
        node_type: String,
    },
    /// List tasks.
    Ls {
        /// Filter by status.
        #[arg(long)]
        status: Option<String>,
        /// Filter by repository.
        #[arg(long)]
        repo: Option<String>,
        /// Maximum rows.
        #[arg(long, default_value_t = 50)]
        limit: i64,
        /// Output format.
        #[arg(long, value_enum, default_value_t = Format::Table)]
        format: Format,
    },
    /// Show a task with its edges.
    Show {
        /// Task identifier (full UUID or >=8 hex chars).
        id: String,
        /// Output format.
        #[arg(long, value_enum, default_value_t = Format::Table)]
        format: Format,
    },
    /// Acknowledge, edit, or reject a task.
    Ack {
        /// Task identifier.
        id: String,
        /// Open `$EDITOR` to update title and body before ack.
        #[arg(long)]
        edit: bool,
        /// Reject the task instead of acking.
        #[arg(long)]
        reject: bool,
        /// Reason for rejection.
        #[arg(long, requires = "reject")]
        reason: Option<String>,
    },
    /// Render the morning standup proposals.
    Daily {
        #[arg(long)]
        since: Option<String>,
        #[arg(long, default_value = "10")]
        limit: i64,
        #[arg(long, value_enum, default_value_t = Format::Table)]
        format: Format,
    },
    /// Semantic search across tasks.
    Search {
        query: String,
        #[arg(long, default_value = "10")]
        limit: i64,
        #[arg(long, value_enum, default_value_t = Format::Table)]
        format: Format,
    },
    /// Walk task provenance.
    Why {
        id: String,
        #[arg(long, value_enum, default_value_t = Format::Table)]
        format: Format,
    },
    /// Record a time estimate or completion.
    Estimate {
        id: String,
        hours: f64,
    },
    Done {
        id: String,
        hours: f64,
    },
    /// Calibration accuracy stats.
    Stats {
        #[arg(long, default_value = "30")]
        days: u32,
    },
    /// Sprint capacity plan.
    Plan {
        #[arg(long, default_value = "5")]
        days: u32,
    },
    /// Dispatch acked tasks to a Claude Code subagent.
    Dispatch {
        id: Option<String>,
        #[arg(long)]
        dry_run: bool,
    },
    /// Manage repository git hooks.
    Hooks {
        #[command(subcommand)]
        action: HooksAction,
    },
    /// Run or inspect the long-lived ingestion coordinator.
    Daemon {
        #[command(subcommand)]
        action: DaemonAction,
    },
    /// Inspect LLM spend recorded in the cost ledger.
    Cost {
        /// Number of days to summarize (inclusive of today, UTC).
        #[arg(long, default_value_t = 7)]
        days: u32,
        /// Ledger root; defaults to `<cwd>/reports/cost`.
        #[arg(long, env = "WLOG_COST_REPORTS_DIR")]
        reports_dir: Option<PathBuf>,
    },
    /// Print a shell completion script.
    Completions {
        /// Target shell.
        #[arg(value_enum)]
        shell: Shell,
    },
}

#[derive(Debug, Subcommand)]
enum DaemonAction {
    /// Run the daemon in the foreground until Ctrl-C.
    Run {
        /// Override the default socket path (XDG_RUNTIME_DIR/wlog.sock).
        #[arg(long, env = "WLOG_SOCKET")]
        socket: Option<PathBuf>,
        /// NATS URL; if unset the daemon just logs incoming payloads.
        #[arg(long, env = "WLOG_NATS_URL")]
        nats_url: Option<String>,
        /// Path to `~/.claude/projects/` to watch. Unset disables the
        /// CC worker. Pass `--cc-projects-dir auto` to use the default.
        #[arg(long, env = "WLOG_CC_PROJECTS_DIR")]
        cc_projects_dir: Option<PathBuf>,
        /// Override the CC cursor location.
        #[arg(long, env = "WLOG_CC_CURSOR")]
        cc_cursor: Option<PathBuf>,
        /// TCP listen address for the GitHub webhook receiver. Unset
        /// disables the GH worker.
        #[arg(long, env = "WLOG_GH_LISTEN")]
        gh_listen: Option<String>,
        /// HMAC secret for GitHub webhook verification.
        #[arg(long, env = "WLOG_GH_SECRET")]
        gh_secret: Option<String>,
    },
    /// Print whether a daemon socket currently exists.
    Status {
        /// Override the default socket path.
        #[arg(long, env = "WLOG_SOCKET")]
        socket: Option<PathBuf>,
    },
}

#[derive(Debug, Subcommand)]
enum HooksAction {
    /// Install wlog-managed hooks (post-commit, post-merge, pre-push).
    Install {
        /// Repository root (defaults to current working directory).
        #[arg(long, default_value = ".")]
        repo: PathBuf,
        /// Overwrite hooks that wlog did not write.
        #[arg(long)]
        force: bool,
    },
    /// Remove wlog-managed hooks; foreign hooks are left untouched.
    Uninstall {
        /// Repository root.
        #[arg(long, default_value = ".")]
        repo: PathBuf,
    },
    /// Report which hooks are currently managed by wlog.
    Status {
        /// Repository root.
        #[arg(long, default_value = ".")]
        repo: PathBuf,
    },
    /// Internal: hook scripts invoke this to forward an event to the
    /// daemon socket. Phase 1 implements the publisher; today this only
    /// logs and exits 0 so the hook never fails the user's commit.
    Notify {
        /// Hook kind name (`post-commit`, `post-merge`, `pre-push`).
        kind: String,
        /// Remaining hook arguments.
        #[arg(allow_hyphen_values = true, trailing_var_arg = true)]
        args: Vec<String>,
    },
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")),
        )
        .with_target(false)
        .with_writer(std::io::stderr)
        .init();
    let cli = Cli::parse();
    match run(cli).await {
        Ok(code) => code,
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::from(1)
        }
    }
}

async fn run(cli: Cli) -> Result<ExitCode> {
    match cli.command {
        Command::Init {
            slug,
            name,
            user,
            database_url,
            force,
        } => init(slug, name, user, database_url, force).await,
        Command::Add {
            title,
            body,
            repo,
            node_type,
        } => add(cli.config.as_deref(), title, body, repo, node_type).await,
        Command::Ls {
            status,
            repo,
            limit,
            format,
        } => ls(cli.config.as_deref(), status, repo, limit, format).await,
        Command::Show { id, format } => show(cli.config.as_deref(), id, format).await,
        Command::Ack {
            id,
            edit,
            reject,
            reason,
        } => ack(cli.config.as_deref(), id, edit, reject, reason).await,
        Command::Daily {
            since,
            limit,
            format,
        } => daily(cli.config.as_deref(), since, limit, format).await,
        Command::Search {
            query,
            limit,
            format,
        } => search(cli.config.as_deref(), query, limit, format).await,
        Command::Why { id, format } => why(cli.config.as_deref(), id, format).await,
        Command::Estimate { id, hours } => estimate(cli.config.as_deref(), id, hours).await,
        Command::Done { id, hours } => done(cli.config.as_deref(), id, hours).await,
        Command::Stats { days } => stats(cli.config.as_deref(), days).await,
        Command::Plan { days } => plan(cli.config.as_deref(), days).await,
        Command::Dispatch { id, dry_run } => dispatch(cli.config.as_deref(), id, dry_run).await,
        Command::Hooks { action } => Ok(hooks(action)),
        Command::Daemon { action } => daemon_cmd(action).await,
        Command::Cost { days, reports_dir } => Ok(cost(days, reports_dir)),
        Command::Completions { shell } => Ok(completions(shell)),
    }
}

async fn daily(
    config_path: Option<&std::path::Path>,
    _since: Option<String>,
    limit: i64,
    format: Format,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found; run `wlog init` first");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool);
    let rows = tasks
        .list(
            loaded.config.workspace.workspace_id(),
            TaskListFilter {
                status: Some(TaskStatus::Proposed),
                repo: None,
                owner: None,
                limit: Some(limit),
            },
        )
        .await?;
    let mut stdout = std::io::stdout().lock();
    if rows.is_empty() {
        eprintln!("no proposed tasks; run the synthesis worker to populate");
    }
    output::print_tasks(&mut stdout, &rows, format)?;
    Ok(ExitCode::SUCCESS)
}

async fn search(
    config_path: Option<&std::path::Path>,
    query: String,
    limit: i64,
    format: Format,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool);
    let rows = tasks
        .list(
            loaded.config.workspace.workspace_id(),
            TaskListFilter {
                status: None,
                repo: None,
                owner: None,
                limit: Some(limit * 4),
            },
        )
        .await?;
    let needle = query.to_lowercase();
    let mut matches: Vec<_> = rows
        .into_iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&needle)
                || t.body
                    .as_deref()
                    .is_some_and(|b| b.to_lowercase().contains(&needle))
        })
        .take(usize::try_from(limit).unwrap_or(10))
        .collect();
    matches.truncate(usize::try_from(limit).unwrap_or(10));
    let mut stdout = std::io::stdout().lock();
    output::print_tasks(&mut stdout, &matches, format)?;
    Ok(ExitCode::SUCCESS)
}

async fn why(
    config_path: Option<&std::path::Path>,
    id: String,
    format: Format,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool.clone());
    let events = wlog_storage::EventRepo::new(pool.clone());
    let edges = wlog_storage::EdgeRepo::new(pool);
    let tid = match Uuid::parse_str(&id) {
        Ok(u) => TaskId(u),
        Err(_) => {
            let matches = tasks
                .resolve_short(loaded.config.workspace.workspace_id(), &id, 4)
                .await?;
            match matches.len() {
                1 => matches[0],
                0 => {
                    eprintln!("error: task not found");
                    return Ok(ExitCode::from(2));
                }
                _ => {
                    eprintln!("error: ambiguous prefix");
                    return Ok(ExitCode::from(1));
                }
            }
        }
    };
    let task = tasks.get(tid).await?;
    let event_ids = events.for_task(tid).await?;
    let outgoing = edges.outgoing(tid).await?;
    let incoming = edges.incoming(tid).await?;
    match format {
        Format::Json => {
            let json = serde_json::json!({
                "task": serde_json::to_value(&task)?,
                "events": event_ids,
                "outgoing": serde_json::to_value(&outgoing)?,
                "incoming": serde_json::to_value(&incoming)?,
            });
            println!("{}", serde_json::to_string_pretty(&json)?);
        }
        _ => {
            println!("task {}", task.id.as_uuid());
            println!("  title: {}", task.title);
            println!("  status: {}", task.status.as_str());
            println!("  events: {}", event_ids.len());
            for e in &event_ids {
                println!("    - {e}");
            }
            println!("  outgoing edges: {}", outgoing.len());
            println!("  incoming edges: {}", incoming.len());
        }
    }
    Ok(ExitCode::SUCCESS)
}

async fn estimate(
    config_path: Option<&std::path::Path>,
    id: String,
    hours: f64,
) -> Result<ExitCode> {
    let loaded = config::load(config_path).map_err(anyhow::Error::from)?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tid = resolve_id(&pool, &loaded.config.workspace, &id).await?;
    let repo = wlog_storage::EstimationRepo::new(pool);
    let e = repo
        .record(
            loaded.config.workspace.workspace_id(),
            tid,
            wlog_storage::Estimator::Human,
            hours,
        )
        .await?;
    println!(
        "recorded {:.2}h estimate for {}",
        e.estimated_hours,
        tid.short()
    );
    Ok(ExitCode::SUCCESS)
}

async fn done(config_path: Option<&std::path::Path>, id: String, hours: f64) -> Result<ExitCode> {
    let loaded = config::load(config_path).map_err(anyhow::Error::from)?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tid = resolve_id(&pool, &loaded.config.workspace, &id).await?;
    let tasks = TaskRepo::new(pool.clone());
    let completions = wlog_storage::CompletionRepo::new(pool);
    // Transition acked/in_progress -> done.
    let current = tasks.get(tid).await?;
    if current.status != TaskStatus::Done {
        if current.status == TaskStatus::Acked {
            tasks.set_status(tid, TaskStatus::InProgress).await?;
        }
        tasks.set_status(tid, TaskStatus::Done).await?;
    }
    let c = completions
        .record(loaded.config.workspace.workspace_id(), tid, hours)
        .await?;
    println!(
        "recorded {:.2}h completion for {}",
        c.actual_hours,
        tid.short()
    );
    Ok(ExitCode::SUCCESS)
}

async fn stats(config_path: Option<&std::path::Path>, days: u32) -> Result<ExitCode> {
    let loaded = config::load(config_path).map_err(anyhow::Error::from)?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let estimations_repo = wlog_storage::EstimationRepo::new(pool.clone());
    let completions_repo = wlog_storage::CompletionRepo::new(pool);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(i64::from(days));
    let completions = completions_repo
        .for_workspace(loaded.config.workspace.workspace_id(), 500)
        .await?
        .into_iter()
        .filter(|c| c.completed_at >= cutoff)
        .collect::<Vec<_>>();
    if completions.is_empty() {
        println!("no completions in the last {days} days");
        return Ok(ExitCode::SUCCESS);
    }
    let mut bias_sum = 0.0f64;
    let mut bias_count = 0u32;
    let mut mape_sum = 0.0f64;
    for c in &completions {
        if let Some(est) = estimations_repo
            .for_task(c.task_id)
            .await?
            .into_iter()
            .last()
        {
            let ratio = c.actual_hours / est.estimated_hours;
            bias_sum += ratio.ln();
            mape_sum += (c.actual_hours - est.estimated_hours).abs() / est.estimated_hours;
            bias_count += 1;
        }
    }
    println!("calibration over {days} days:");
    println!("  completions: {}", completions.len());
    println!("  estimated:   {}", bias_count);
    if bias_count > 0 {
        let mean_ln_ratio = bias_sum / f64::from(bias_count);
        let bias_pct = (mean_ln_ratio.exp() - 1.0) * 100.0;
        let mape = mape_sum / f64::from(bias_count) * 100.0;
        println!("  bias (geo mean ratio): {bias_pct:+.1}%");
        println!("  MAPE: {mape:.1}%");
    }
    Ok(ExitCode::SUCCESS)
}

async fn plan(config_path: Option<&std::path::Path>, days: u32) -> Result<ExitCode> {
    let loaded = config::load(config_path).map_err(anyhow::Error::from)?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool.clone());
    let estimations_repo = wlog_storage::EstimationRepo::new(pool.clone());
    let completions_repo = wlog_storage::CompletionRepo::new(pool);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    let completions = completions_repo
        .for_workspace(loaded.config.workspace.workspace_id(), 500)
        .await?
        .into_iter()
        .filter(|c| c.completed_at >= cutoff)
        .collect::<Vec<_>>();
    let mut bias = 1.0f64;
    if !completions.is_empty() {
        let mut sum_ln = 0.0;
        let mut n = 0u32;
        for c in &completions {
            if let Some(est) = estimations_repo
                .for_task(c.task_id)
                .await?
                .into_iter()
                .last()
            {
                sum_ln += (c.actual_hours / est.estimated_hours).ln();
                n += 1;
            }
        }
        if n > 0 {
            bias = (sum_ln / f64::from(n)).exp();
        }
    }
    let acked = tasks
        .list(
            loaded.config.workspace.workspace_id(),
            TaskListFilter {
                status: Some(TaskStatus::Acked),
                repo: None,
                owner: None,
                limit: Some(500),
            },
        )
        .await?;
    let mut planned_hours = 0.0f64;
    for t in &acked {
        let est = estimations_repo.for_task(t.id).await?;
        if let Some(latest) = est.last() {
            planned_hours += latest.estimated_hours * bias;
        }
    }
    let capacity = f64::from(days) * 6.0;
    println!("sprint plan ({days} days):");
    println!("  open acked tasks: {}", acked.len());
    println!("  bias multiplier: {bias:.2}");
    println!("  planned hours (bias-adjusted): {planned_hours:.1}");
    println!("  capacity at 6h/day: {capacity:.1}");
    if planned_hours > capacity {
        println!(
            "  WARNING: overcommitted by {:.1}h",
            planned_hours - capacity
        );
    } else {
        println!("  headroom: {:.1}h", capacity - planned_hours);
    }
    Ok(ExitCode::SUCCESS)
}

async fn dispatch(
    config_path: Option<&std::path::Path>,
    id: Option<String>,
    dry_run: bool,
) -> Result<ExitCode> {
    let loaded = config::load(config_path).map_err(anyhow::Error::from)?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool.clone());
    let candidates: Vec<_> = if let Some(idstr) = id {
        let tid = resolve_id(&pool, &loaded.config.workspace, &idstr).await?;
        vec![tasks.get(tid).await?]
    } else {
        tasks
            .list(
                loaded.config.workspace.workspace_id(),
                TaskListFilter {
                    status: Some(TaskStatus::Acked),
                    repo: None,
                    owner: None,
                    limit: Some(20),
                },
            )
            .await?
    };
    for t in &candidates {
        let classifier = wlog_engine::dispatch::classify(t);
        if dry_run {
            println!("{} {} -> {:?}", t.id.short(), t.title, classifier);
        } else if classifier == wlog_engine::dispatch::DispatchClass::AgentEligible {
            println!("dispatching {} (stub)", t.id.short());
        } else {
            println!("skipping {} ({:?})", t.id.short(), classifier);
        }
    }
    Ok(ExitCode::SUCCESS)
}

async fn resolve_id(pool: &sqlx::PgPool, workspace: &WorkspaceConfig, raw: &str) -> Result<TaskId> {
    if let Ok(u) = Uuid::parse_str(raw) {
        return Ok(TaskId(u));
    }
    let tasks = TaskRepo::new(pool.clone());
    let matches = tasks
        .resolve_short(workspace.workspace_id(), raw, 4)
        .await?;
    match matches.len() {
        1 => Ok(matches[0]),
        0 => Err(anyhow!("task not found")),
        _ => Err(anyhow!("ambiguous id prefix")),
    }
}

fn cost(days: u32, reports_dir: Option<PathBuf>) -> ExitCode {
    use std::collections::BTreeMap;

    use wlog_engine::cost::CostLedger;

    let root = reports_dir.unwrap_or_else(|| PathBuf::from("reports/cost"));
    let ledger = CostLedger::new(root.clone());
    let today = chrono::Utc::now().date_naive();

    let mut per_day: Vec<(chrono::NaiveDate, f64, usize)> = Vec::new();
    let mut per_model: BTreeMap<String, (u64, u64, u64, u64, f64)> = BTreeMap::new();
    let mut grand_total = 0.0f64;
    let mut total_rows = 0usize;

    for offset in (0..i64::from(days)).rev() {
        let date = today - chrono::Duration::days(offset);
        let entries = match ledger.read_day(date) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("error: read {date}: {e}");
                return ExitCode::from(1);
            }
        };
        let mut day_total = 0.0f64;
        for entry in &entries {
            day_total += entry.usd;
            grand_total += entry.usd;
            total_rows += 1;
            let row = per_model
                .entry(entry.usage.model.clone())
                .or_insert((0, 0, 0, 0, 0.0));
            row.0 += u64::from(entry.usage.input_tokens);
            row.1 += u64::from(entry.usage.output_tokens);
            row.2 += u64::from(entry.usage.cache_creation_input_tokens);
            row.3 += u64::from(entry.usage.cache_read_input_tokens);
            row.4 += entry.usd;
        }
        per_day.push((date, day_total, entries.len()));
    }

    println!("Cost ledger {}", root.display());
    println!("Window: last {days} days (UTC, inclusive of today)");
    println!();
    println!("{:<12}  {:>10}  {:>10}", "DATE", "ROWS", "USD");
    println!("{}", "-".repeat(36));
    for (date, total, rows) in &per_day {
        println!("{date:<12}  {rows:>10}  {total:>10.4}");
    }
    println!("{}", "-".repeat(36));
    println!("{:<12}  {:>10}  {:>10.4}", "TOTAL", total_rows, grand_total);
    println!();
    if !per_model.is_empty() {
        println!(
            "{:<32}  {:>10}  {:>10}  {:>10}  {:>10}  {:>10}",
            "MODEL", "INPUT", "OUTPUT", "CACHE_W", "CACHE_R", "USD"
        );
        println!("{}", "-".repeat(96));
        for (model, (input, output, cw, cr, usd)) in &per_model {
            println!("{model:<32}  {input:>10}  {output:>10}  {cw:>10}  {cr:>10}  {usd:>10.4}");
        }
    }
    ExitCode::SUCCESS
}

async fn daemon_cmd(action: DaemonAction) -> Result<ExitCode> {
    use std::sync::Arc;

    use tokio::sync::Notify;

    match action {
        DaemonAction::Run {
            socket,
            nats_url,
            cc_projects_dir,
            cc_cursor,
            gh_listen,
            gh_secret,
        } => {
            let socket = socket.unwrap_or_else(wlog_ingest_git::default_socket_path);
            // `--cc-projects-dir auto` resolves to the default; any other
            // value (or the env-var equivalent) is taken verbatim.
            let cc_projects_dir = cc_projects_dir.map(|p| {
                if p.as_os_str() == "auto" {
                    wlog_ingest_cc::default_projects_dir()
                } else {
                    p
                }
            });
            let config = daemon::DaemonConfig {
                socket: socket.clone(),
                nats_url,
                cc_projects_dir,
                cc_cursor_path: cc_cursor,
                gh_listen,
                gh_secret,
            };
            let shutdown = Arc::new(Notify::new());
            let shutdown_signal = Arc::clone(&shutdown);
            tokio::spawn(async move {
                if tokio::signal::ctrl_c().await.is_ok() {
                    tracing::info!("ctrl-c received");
                    shutdown_signal.notify_waiters();
                }
            });
            let stats = daemon::run(config, shutdown).await?;
            tracing::info!(
                socket_payloads = stats.socket_payloads,
                cc_events = stats.cc_events,
                gh_events = stats.gh_events,
                "daemon shut down cleanly"
            );
            Ok(ExitCode::SUCCESS)
        }
        DaemonAction::Status { socket } => {
            let socket = socket.unwrap_or_else(wlog_ingest_git::default_socket_path);
            if socket.exists() {
                println!("listening at {}", socket.display());
                Ok(ExitCode::SUCCESS)
            } else {
                println!("no daemon socket at {}", socket.display());
                Ok(ExitCode::from(2))
            }
        }
    }
}

fn hooks(action: HooksAction) -> ExitCode {
    use wlog_ingest_git::{HookAction, HookKind, HookReport, install_all, status, uninstall_all};

    fn render(action: &str, report: &HookReport) {
        println!("{action}:");
        for (kind, outcome) in &report.entries {
            let label = match kind {
                HookKind::PostCommit => "post-commit",
                HookKind::PostMerge => "post-merge",
                HookKind::PrePush => "pre-push",
            };
            let outcome_str = match outcome {
                HookAction::Installed => "installed",
                HookAction::Unchanged => "unchanged",
                HookAction::Overwritten => "overwritten",
                HookAction::Removed => "removed",
                HookAction::Skipped => "skipped",
            };
            println!("  {label:<12} {outcome_str}");
        }
    }

    match action {
        HooksAction::Install { repo, force } => match install_all(&repo, force) {
            Ok(report) => {
                render("install", &report);
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("error: {e}");
                ExitCode::from(1)
            }
        },
        HooksAction::Uninstall { repo } => match uninstall_all(&repo) {
            Ok(report) => {
                render("uninstall", &report);
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("error: {e}");
                ExitCode::from(1)
            }
        },
        HooksAction::Status { repo } => match status(&repo) {
            Ok(report) => {
                render("status", &report);
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("error: {e}");
                ExitCode::from(1)
            }
        },
        HooksAction::Notify { kind, args } => notify(kind, args),
    }
}

/// Capture the git context, build a [`HookPayload`], and write it to the
/// local daemon socket. Designed to never fail the user's commit:
///
/// - Anything goes wrong, return `ExitCode::SUCCESS` and log at debug.
/// - The hook stays out of the developer's way.
///
/// When `WLOG_HOOKS_NOTIFY_STRICT=1` is set we surface errors instead;
/// integration tests rely on that to assert the wire path.
fn notify(kind: String, args: Vec<String>) -> ExitCode {
    let payload = wlog_ingest_git::HookPayload {
        kind,
        cwd: std::env::current_dir().map_or_else(|_| String::new(), |p| p.display().to_string()),
        args,
        repo_remote: git_remote_url(),
        head_sha: git_head_sha(),
        branch: git_current_branch(),
        emitted_at: chrono::Utc::now(),
    };
    let socket = std::env::var("WLOG_SOCKET").map_or_else(
        |_| wlog_ingest_git::default_socket_path(),
        std::path::PathBuf::from,
    );
    match wlog_ingest_git::write_payload(&socket, &payload) {
        Ok(()) => {
            tracing::debug!(kind = %payload.kind, socket = %socket.display(), "hook notify sent");
            ExitCode::SUCCESS
        }
        Err(e) => {
            tracing::debug!(
                kind = %payload.kind,
                socket = %socket.display(),
                error = %e,
                "hook notify failed (silenced)"
            );
            if std::env::var_os("WLOG_HOOKS_NOTIFY_STRICT").is_some_and(|v| !v.is_empty()) {
                eprintln!("error: hook notify failed: {e}");
                ExitCode::from(1)
            } else {
                ExitCode::SUCCESS
            }
        }
    }
}

fn git_command(args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git").args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8(output.stdout).ok()?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn git_head_sha() -> Option<String> {
    git_command(&["rev-parse", "HEAD"])
}

fn git_current_branch() -> Option<String> {
    git_command(&["rev-parse", "--abbrev-ref", "HEAD"]).filter(|b| b != "HEAD")
}

fn git_remote_url() -> Option<String> {
    git_command(&["config", "--get", "remote.origin.url"])
}

fn completions(shell: Shell) -> ExitCode {
    let mut cmd = Cli::command();
    let name = cmd.get_name().to_string();
    clap_complete::generate(shell, &mut cmd, name, &mut std::io::stdout());
    ExitCode::SUCCESS
}

async fn init(
    slug: Option<String>,
    name: Option<String>,
    user_handle: String,
    database_url: String,
    force: bool,
) -> Result<ExitCode> {
    let slug = match slug {
        Some(s) => s,
        None => derive_slug_from_cwd()?,
    };
    let display_name = name.unwrap_or_else(|| slug.clone());

    // Healthcheck before writing anything.
    let storage_config = StorageConfig {
        url: database_url.clone(),
        max_connections: 5,
    };
    let pool = connect(&storage_config)
        .await
        .with_context(|| format!("connecting to {database_url}"))?;
    migrate(&pool).await.context("running migrations")?;
    healthcheck(&pool).await.context("healthcheck")?;

    let ws_repo = WorkspaceRepo::new(pool.clone());
    let workspace = match ws_repo.get_by_slug(&slug).await {
        Ok(w) => w,
        Err(StorageError::NotFound) => ws_repo
            .create(NewWorkspace {
                slug: slug.clone(),
                name: display_name.clone(),
            })
            .await
            .context("creating workspace")?,
        Err(e) => return Err(e.into()),
    };

    let users = UserRepo::new(pool.clone());
    let user = match users.get_by_handle(workspace.id, &user_handle).await {
        Ok(u) => u,
        Err(StorageError::NotFound) => users
            .create(NewUser {
                workspace_id: workspace.id,
                handle: user_handle.clone(),
                email: None,
            })
            .await
            .context("creating user")?,
        Err(e) => return Err(e.into()),
    };

    let cfg = Config {
        workspace: WorkspaceConfig {
            id: workspace.id.0,
            slug: workspace.slug,
            user_handle: user.handle,
        },
        storage: StorageSection {
            url: database_url,
            max_connections: 10,
        },
    };
    let written = match config::write(&cfg, force) {
        Ok(p) => p,
        Err(ConfigError::AlreadyExists(p)) => {
            eprintln!("error: config already exists at {}", p.display());
            eprintln!("  hint: pass --force to overwrite");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    println!(
        "workspace {} ready ({})",
        cfg.workspace.slug, workspace.id.0
    );
    println!("config written to {}", written.display());
    Ok(ExitCode::SUCCESS)
}

async fn add(
    config_path: Option<&std::path::Path>,
    title: String,
    body: Option<String>,
    repo: Option<String>,
    node_type: String,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found; run `wlog init` first");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let node_type =
        NodeType::parse(&node_type).ok_or_else(|| anyhow!("unknown node_type {node_type:?}"))?;
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool.clone());
    let users = UserRepo::new(pool.clone());
    let owner = users
        .get_by_handle(
            loaded.config.workspace.workspace_id(),
            &loaded.config.workspace.user_handle,
        )
        .await
        .ok()
        .map(|u| u.id);
    let created = tasks
        .create(NewTask {
            workspace_id: loaded.config.workspace.workspace_id(),
            node_type,
            title,
            body,
            repo,
            owner,
            status: Some(TaskStatus::Acked),
        })
        .await?;
    println!("{}", created.id.short());
    Ok(ExitCode::SUCCESS)
}

async fn ls(
    config_path: Option<&std::path::Path>,
    status: Option<String>,
    repo: Option<String>,
    limit: i64,
    format: Format,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found; run `wlog init` first");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let status = match status {
        Some(s) => Some(TaskStatus::parse(&s).ok_or_else(|| anyhow!("unknown status {s:?}"))?),
        None => None,
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool);
    let rows = tasks
        .list(
            loaded.config.workspace.workspace_id(),
            TaskListFilter {
                status,
                repo,
                owner: None,
                limit: Some(limit),
            },
        )
        .await?;
    let mut stdout = std::io::stdout().lock();
    output::print_tasks(&mut stdout, &rows, format)?;
    Ok(ExitCode::SUCCESS)
}

async fn show(
    config_path: Option<&std::path::Path>,
    id: String,
    format: Format,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found; run `wlog init` first");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool.clone());
    let edges = EdgeRepo::new(pool);
    let resolved = resolve_task_id(&tasks, &loaded.config.workspace, &id).await?;
    let task = match resolved {
        ResolvedId::Single(tid) => tasks.get(tid).await?,
        ResolvedId::Ambiguous(ids) => {
            eprintln!("error: ambiguous id prefix; matches:");
            for tid in ids {
                eprintln!("  {}", tid.as_uuid());
            }
            return Ok(ExitCode::from(1));
        }
        ResolvedId::Missing => {
            eprintln!("error: task not found");
            return Ok(ExitCode::from(2));
        }
    };
    let outgoing = edges.outgoing(task.id).await?;
    let incoming = edges.incoming(task.id).await?;

    match format {
        Format::Table => {
            println!("id:         {}", task.id.as_uuid());
            println!("short:      {}", task.id.short());
            println!("status:     {}", task.status.as_str());
            println!("type:       {}", task.node_type.as_str());
            println!("title:      {}", task.title);
            if let Some(repo) = &task.repo {
                println!("repo:       {repo}");
            }
            println!("created_at: {}", task.created_at.to_rfc3339());
            println!("updated_at: {}", task.updated_at.to_rfc3339());
            if let Some(body) = &task.body {
                println!("\nbody:\n{body}");
            }
            if !outgoing.is_empty() {
                println!("\noutgoing edges:");
                for e in &outgoing {
                    println!(
                        "  {} -> {} ({})",
                        e.from_task.as_uuid(),
                        e.to_task.as_uuid(),
                        e.edge_type.as_str()
                    );
                }
            }
            if !incoming.is_empty() {
                println!("\nincoming edges:");
                for e in &incoming {
                    println!(
                        "  {} -> {} ({})",
                        e.from_task.as_uuid(),
                        e.to_task.as_uuid(),
                        e.edge_type.as_str()
                    );
                }
            }
        }
        Format::Json => {
            let json = serde_json::json!({
                "task": serde_json::to_value(&task)?,
                "outgoing": serde_json::to_value(&outgoing)?,
                "incoming": serde_json::to_value(&incoming)?,
            });
            println!("{}", serde_json::to_string_pretty(&json)?);
        }
        Format::Tsv => {
            let mut stdout = std::io::stdout().lock();
            output::print_tasks(&mut stdout, std::slice::from_ref(&task), Format::Tsv)?;
        }
    }
    Ok(ExitCode::SUCCESS)
}

async fn ack(
    config_path: Option<&std::path::Path>,
    id: String,
    edit: bool,
    reject: bool,
    reason: Option<String>,
) -> Result<ExitCode> {
    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            eprintln!("error: no wlog.toml found; run `wlog init` first");
            return Ok(ExitCode::from(1));
        }
        Err(e) => return Err(e.into()),
    };
    let pool = connect(&StorageConfig {
        url: loaded.config.storage.url.clone(),
        max_connections: loaded.config.storage.max_connections,
    })
    .await?;
    let tasks = TaskRepo::new(pool);
    let resolved = resolve_task_id(&tasks, &loaded.config.workspace, &id).await?;
    let tid = match resolved {
        ResolvedId::Single(t) => t,
        ResolvedId::Ambiguous(ids) => {
            eprintln!("error: ambiguous id prefix; matches:");
            for t in ids {
                eprintln!("  {}", t.as_uuid());
            }
            return Ok(ExitCode::from(1));
        }
        ResolvedId::Missing => {
            eprintln!("error: task not found");
            return Ok(ExitCode::from(2));
        }
    };
    if reject {
        let updated = tasks.set_status(tid, TaskStatus::Rejected).await?;
        let suffix = reason
            .as_ref()
            .map(|r| format!(" ({r})"))
            .unwrap_or_default();
        println!("rejected {}{}", updated.id.short(), suffix);
        return Ok(ExitCode::SUCCESS);
    }
    if edit {
        let current = tasks.get(tid).await?;
        let edited = run_editor(&current.title, current.body.as_deref())?;
        tasks
            .update_text(tid, &edited.title, edited.body.as_deref())
            .await?;
    }
    let updated = tasks.set_status(tid, TaskStatus::Acked).await?;
    println!("acked {}", updated.id.short());
    Ok(ExitCode::SUCCESS)
}

enum ResolvedId {
    Single(TaskId),
    Ambiguous(Vec<TaskId>),
    Missing,
}

async fn resolve_task_id(
    tasks: &TaskRepo,
    workspace: &WorkspaceConfig,
    raw: &str,
) -> Result<ResolvedId> {
    // Try full UUID first.
    if let Ok(uuid) = Uuid::parse_str(raw) {
        return match tasks.get(TaskId(uuid)).await {
            Ok(_) => Ok(ResolvedId::Single(TaskId(uuid))),
            Err(StorageError::NotFound) => Ok(ResolvedId::Missing),
            Err(e) => Err(e.into()),
        };
    }
    let stripped: String = raw.chars().filter(|c| *c != '-').collect();
    let matches = tasks
        .resolve_short(workspace.workspace_id(), &stripped, 8)
        .await?;
    Ok(match matches.len() {
        0 => ResolvedId::Missing,
        1 => ResolvedId::Single(matches[0]),
        _ => ResolvedId::Ambiguous(matches),
    })
}

struct EditedTask {
    title: String,
    body: Option<String>,
}

fn run_editor(title: &str, body: Option<&str>) -> Result<EditedTask> {
    use std::io::{Read, Write};
    let mut tmp = tempfile_in_workspace()?;
    let initial = match body {
        Some(b) => format!("{title}\n\n{b}\n"),
        None => format!("{title}\n"),
    };
    tmp.write_all(initial.as_bytes())?;
    tmp.flush()?;
    let path = tmp.path().to_path_buf();
    drop(tmp);

    let editor = std::env::var("EDITOR")
        .or_else(|_| std::env::var("VISUAL"))
        .unwrap_or_else(|_| "vi".to_string());
    let status = std::process::Command::new(&editor)
        .arg(&path)
        .status()
        .with_context(|| format!("spawning editor {editor}"))?;
    if !status.success() {
        return Err(anyhow!("editor exited with {status}"));
    }
    let mut content = String::new();
    std::fs::File::open(&path)?.read_to_string(&mut content)?;
    let _ = std::fs::remove_file(&path);
    let (title, body) = split_edited(&content)?;
    Ok(EditedTask {
        title: title.to_string(),
        body,
    })
}

fn split_edited(content: &str) -> Result<(&str, Option<String>)> {
    let mut lines = content.lines();
    let title = lines.next().unwrap_or("").trim();
    if title.is_empty() {
        return Err(anyhow!("edited title is empty"));
    }
    let rest: Vec<&str> = lines.collect();
    let body = rest.join("\n").trim().to_string();
    let body = if body.is_empty() { None } else { Some(body) };
    Ok((title, body))
}

struct TmpFile(std::path::PathBuf, std::fs::File);
impl TmpFile {
    fn path(&self) -> &std::path::Path {
        &self.0
    }
}
impl std::io::Write for TmpFile {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.1.write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.1.flush()
    }
}

fn tempfile_in_workspace() -> Result<TmpFile> {
    let dir = std::env::temp_dir();
    let name = format!("wlog-edit-{}.md", uuid::Uuid::new_v4().simple());
    let path = dir.join(name);
    let file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .read(true)
        .open(&path)?;
    Ok(TmpFile(path, file))
}

fn derive_slug_from_cwd() -> Result<String> {
    let cwd = std::env::current_dir()?;
    let name = cwd
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow!("could not derive slug from cwd"))?;
    let slug: String = name
        .chars()
        .map(|c| match c {
            'A'..='Z' => c.to_ascii_lowercase(),
            'a'..='z' | '0'..='9' | '-' => c,
            _ => '-',
        })
        .collect();
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.len() < 2 {
        return Err(anyhow!("derived slug too short; pass --slug explicitly"));
    }
    Ok(trimmed)
}
