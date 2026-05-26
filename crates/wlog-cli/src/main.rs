//! `wlog` command line entry point.

#![warn(missing_docs)]

use wlog_cli::{banner, config, daemon, output};

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{Context, Result, anyhow};
use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::Shell;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;
use wlog_proto::{NodeType, TaskId, TaskStatus};
use wlog_storage::{
    EdgeRepo, EventRepo, NewTask, NewUser, NewWorkspace, StorageConfig, StorageError,
    TaskListFilter, TaskRepo, UserRepo, WorkspaceRepo, connect, healthcheck, migrate,
};

use self::config::{Config, ConfigError, StorageSection, WorkspaceConfig};
use self::output::Format;

#[derive(Debug, Parser)]
#[command(
    name = "wlog",
    version,
    about = "WienerLog: activity-aware task synthesis",
    long_about = "\
WienerLog (`wlog`) observes git, Claude Code, and GitHub activity and
proposes tasks for you to confirm. You never write standup notes
manually; the system watches, you ack or edit.

EXAMPLES
  Bootstrap a workspace and verify install:
      wlog init --slug me --name \"Me\"
      wlog status
      wlog hooks install

  Daily flow:
      wlog daily
      wlog ack <id>
      wlog ack <id> --edit
      wlog search \"auth flow\"

  Run the long-lived ingestor:
      wlog daemon run --nats-url nats://127.0.0.1:4222

  Operator (founder) view:
      wlog admin tail
      wlog admin users
      wlog admin workspaces

  Diagnostics:
      wlog doctor
      wlog where
      wlog about

See docs/onboarding.md (employees) and docs/control-plane.md (operator).
"
)]
struct Cli {
    /// Path to an explicit config file (overrides discovery).
    #[arg(long, global = true, env = "WLOG_CONFIG")]
    config: Option<PathBuf>,
    /// Suppress informational output (errors still print).
    #[arg(long, short = 'q', global = true, env = "WLOG_QUIET")]
    quiet: bool,
    /// Disable ANSI color regardless of TTY detection.
    #[arg(long, global = true, env = "NO_COLOR")]
    no_color: bool,
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
    /// Print the Wiener Labs ASCII banner.
    Banner,
    /// Interactive first-run wizard: prompts for workspace + DB + NATS, then init.
    Setup,
    /// Local diagnostic: daemon socket, NATS round-trip, Postgres, hooks.
    Status {
        /// Skip the NATS round-trip probe.
        #[arg(long)]
        no_nats: bool,
        /// Skip the Postgres `SELECT 1` probe.
        #[arg(long)]
        no_db: bool,
        /// NATS URL override.
        #[arg(long, env = "WLOG_NATS_URL")]
        nats_url: Option<String>,
    },
    /// Print the resolved paths wlog uses (binary, config, socket, cache).
    Where,
    /// Detailed build, version, and environment info.
    About,
    /// Print recent events from the database (newest first).
    Log {
        /// Maximum rows.
        #[arg(long, default_value_t = 50)]
        limit: i64,
        /// Filter by `source.kind`, e.g. `git.post-commit`, `cc.session-start`,
        /// or just `git` to match any kind.
        #[arg(long)]
        kind: Option<String>,
        /// Show all workspaces (requires `WLOG_ADMIN_DATABASE_URL`).
        #[arg(long)]
        all_workspaces: bool,
    },
    /// Render a task and its descendants as an ASCII tree.
    Tree {
        /// Task identifier (full UUID or >=8 hex chars).
        id: String,
        /// Maximum depth to descend.
        #[arg(long, default_value_t = 8)]
        depth: usize,
    },
    /// Run an extended health check (status + version + disk + uptime).
    Doctor {
        /// Skip remote probes (NATS + Postgres).
        #[arg(long)]
        offline: bool,
    },
    /// Operator surface for cross-workspace queries (founder-only).
    Admin {
        #[command(subcommand)]
        action: AdminAction,
    },
    /// Print a shell completion script.
    Completions {
        /// Target shell.
        #[arg(value_enum)]
        shell: Shell,
    },
}

#[derive(Debug, Subcommand)]
enum AdminAction {
    /// List every user across every workspace.
    Users {
        /// Database URL (`WLOG_ADMIN_DATABASE_URL` falls back to
        /// `WLOG_DATABASE_URL`).
        #[arg(long, env = "WLOG_ADMIN_DATABASE_URL")]
        database_url: Option<String>,
        /// Maximum rows.
        #[arg(long, default_value_t = 200)]
        limit: i64,
    },
    /// List every workspace on the Postgres backend.
    Workspaces {
        /// Database URL.
        #[arg(long, env = "WLOG_ADMIN_DATABASE_URL")]
        database_url: Option<String>,
        /// Maximum rows.
        #[arg(long, default_value_t = 200)]
        limit: i64,
    },
    /// Subscribe to `wlog.>` and print every event in real time.
    Tail {
        /// NATS URL.
        #[arg(long, env = "WLOG_NATS_URL", default_value = "nats://127.0.0.1:4222")]
        nats_url: String,
        /// Override the subject filter (`wlog.>` by default).
        #[arg(long, default_value = "wlog.>")]
        subject: String,
        /// Truncate each payload body to N bytes when printing.
        #[arg(long, default_value_t = 240)]
        max_body: usize,
    },
    /// Re-publish historic events from Postgres back to NATS.
    Replay {
        /// Database URL.
        #[arg(long, env = "WLOG_ADMIN_DATABASE_URL")]
        database_url: Option<String>,
        /// NATS URL to publish onto.
        #[arg(long, env = "WLOG_NATS_URL", default_value = "nats://127.0.0.1:4222")]
        nats_url: String,
        /// Filter to this workspace slug (default: all).
        #[arg(long)]
        workspace: Option<String>,
        /// Maximum events to replay.
        #[arg(long, default_value_t = 100)]
        limit: i64,
        /// Print the subject + payload size instead of publishing.
        #[arg(long)]
        dry_run: bool,
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
    if cli.no_color {
        wlog_cli::ui::set_color_override(-1);
    }
    if cli.quiet {
        wlog_cli::ui::set_quiet(true);
    }
    match run(cli).await {
        Ok(code) => code,
        Err(err) => {
            wlog_cli::ui::error(format!("{err:#}"));
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
        Command::Banner => Ok(banner_cmd()),
        Command::Setup => setup_cmd().await,
        Command::Status {
            no_nats,
            no_db,
            nats_url,
        } => status_cmd(cli.config.as_deref(), no_nats, no_db, nats_url).await,
        Command::Where => Ok(where_cmd()),
        Command::About => Ok(about_cmd()),
        Command::Doctor { offline } => doctor_cmd(cli.config.as_deref(), offline).await,
        Command::Log {
            limit,
            kind,
            all_workspaces,
        } => log_cmd(cli.config.as_deref(), limit, kind, all_workspaces).await,
        Command::Tree { id, depth } => tree_cmd(cli.config.as_deref(), id, depth).await,
        Command::Admin { action } => admin_cmd(action).await,
        Command::Completions { shell } => Ok(completions(shell)),
    }
}

fn banner_cmd() -> ExitCode {
    let mut stdout = std::io::stdout().lock();
    let _ = banner::print_banner(&mut stdout, banner::should_color());
    ExitCode::SUCCESS
}

async fn setup_cmd() -> Result<ExitCode> {
    use std::io::{BufRead, Write as _};
    use wlog_cli::ui;

    {
        let mut stdout = std::io::stdout().lock();
        let _ = banner::print_banner(&mut stdout, banner::should_color());
    }
    println!();
    ui::section("interactive setup");
    println!(
        "{}",
        ui::dim("Press Enter to accept the default in (parens)."),
    );
    println!();

    fn prompt(label: &str, default: &str) -> Result<String> {
        let mut out = std::io::stdout().lock();
        write!(out, "  {label} ({default}): ")?;
        out.flush()?;
        drop(out);
        let stdin = std::io::stdin();
        let mut line = String::new();
        stdin.lock().read_line(&mut line)?;
        let trimmed = line.trim().to_string();
        Ok(if trimmed.is_empty() {
            default.to_string()
        } else {
            trimmed
        })
    }

    let cwd_name = std::env::current_dir()
        .ok()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "me".to_string());
    let default_user = std::env::var("USER").unwrap_or_else(|_| "me".to_string());

    let slug = prompt("workspace slug", &cwd_name)?;
    let name = prompt("workspace name", &slug)?;
    let user = prompt("your handle", &default_user)?;
    let database_url = prompt("Postgres URL", "postgres://wlog:wlog@localhost:5435/wlog")?;

    println!();
    ui::section("review");
    ui::kv("slug", &slug);
    ui::kv("name", &name);
    ui::kv("user", &user);
    ui::kv("database", &database_url);
    println!();

    let confirm = prompt("proceed? [y/N]", "y")?;
    if !matches!(confirm.to_lowercase().as_str(), "y" | "yes") {
        ui::warning("aborted");
        return Ok(ExitCode::from(1));
    }

    println!();
    init(Some(slug), Some(name), user, database_url, false).await
}

async fn status_cmd(
    config_path: Option<&std::path::Path>,
    no_nats: bool,
    no_db: bool,
    nats_url_override: Option<String>,
) -> Result<ExitCode> {
    use std::time::Instant;
    use wlog_cli::ui;

    ui::banner_heading("wlog status");

    let mut all_ok = true;
    let mut warns: Vec<String> = Vec::new();

    // -- daemon socket -----------------------------------------------------
    let socket_path = wlog_ingest_git::default_socket_path();
    let socket_present = socket_path.exists();
    if socket_present {
        ui::line(
            ui::Status::Ok,
            "daemon socket",
            &socket_path.display().to_string(),
        );
    } else {
        ui::line(
            ui::Status::Fail,
            "daemon socket",
            &socket_path.display().to_string(),
        );
        warns.push("start the daemon (`wlog daemon run` or your systemd/launchd unit)".to_string());
        all_ok = false;
    }

    // -- git hooks ---------------------------------------------------------
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let in_repo = cwd.join(".git").exists();
    if in_repo {
        match wlog_ingest_git::status(&cwd) {
            Ok(report) => {
                let installed = report
                    .entries
                    .iter()
                    .all(|(_, outcome)| matches!(outcome, wlog_ingest_git::HookAction::Installed));
                let label = cwd.display().to_string();
                if installed {
                    ui::line(ui::Status::Ok, "git hooks", &label);
                } else {
                    ui::line(ui::Status::Fail, "git hooks", &label);
                    for (kind, outcome) in &report.entries {
                        if !matches!(outcome, wlog_ingest_git::HookAction::Installed) {
                            println!("       {} {:?}: {:?}", ui::dim("·"), kind, outcome);
                        }
                    }
                    warns.push("run `wlog hooks install` from inside the repo".to_string());
                    all_ok = false;
                }
            }
            Err(e) => {
                ui::line(
                    ui::Status::Warn,
                    "git hooks",
                    &format!("unable to read ({e})"),
                );
                all_ok = false;
            }
        }
    } else {
        ui::line(ui::Status::Neutral, "git hooks", "not in a git repo");
    }

    // -- NATS --------------------------------------------------------------
    let nats_url = nats_url_override
        .or_else(|| std::env::var("WLOG_NATS_URL").ok())
        .unwrap_or_else(|| "nats://127.0.0.1:4222".to_string());
    if no_nats {
        ui::line(ui::Status::Neutral, "NATS", "skipped (--no-nats)");
    } else {
        let start = Instant::now();
        match async_nats::connect(&nats_url).await {
            Ok(client) => match client.flush().await {
                Ok(()) => {
                    let elapsed = start.elapsed();
                    let detail = format!("{nats_url} ({} round-trip)", format_dur(elapsed));
                    ui::line(ui::Status::Ok, "NATS", &detail);
                }
                Err(e) => {
                    ui::line(ui::Status::Fail, "NATS", &format!("flush failed: {e}"));
                    all_ok = false;
                }
            },
            Err(e) => {
                ui::line(ui::Status::Fail, "NATS", &format!("{nats_url} -> {e}"));
                warns.push("ensure NATS is reachable; for local: `docker compose -f infra/docker-compose.yml up -d nats`".to_string());
                all_ok = false;
            }
        }
    }

    // -- Postgres ---------------------------------------------------------
    if no_db {
        ui::line(ui::Status::Neutral, "Postgres", "skipped (--no-db)");
    } else {
        match config::load(config_path) {
            Ok(loaded) => {
                let cfg = StorageConfig {
                    url: loaded.config.storage.url.clone(),
                    max_connections: 1,
                };
                let url = cfg.url.clone();
                match connect(&cfg).await {
                    Ok(pool) => match healthcheck(&pool).await {
                        Ok(()) => ui::line(ui::Status::Ok, "Postgres", &url),
                        Err(e) => {
                            ui::line(
                                ui::Status::Fail,
                                "Postgres",
                                &format!("{url} -> healthcheck failed: {e}"),
                            );
                            all_ok = false;
                        }
                    },
                    Err(e) => {
                        ui::line(ui::Status::Fail, "Postgres", &format!("{url} -> {e}"));
                        all_ok = false;
                    }
                }
            }
            Err(ConfigError::NotFound) => {
                ui::line(
                    ui::Status::Neutral,
                    "Postgres",
                    "no wlog.toml; run `wlog init` (skipped)",
                );
            }
            Err(e) => {
                ui::line(ui::Status::Fail, "Postgres", &format!("config error: {e}"));
                all_ok = false;
            }
        }
    }

    println!();
    if all_ok {
        ui::success("wlog is healthy on this machine.");
        Ok(ExitCode::SUCCESS)
    } else {
        ui::error("one or more components are not ready");
        for w in warns {
            ui::hint(w);
        }
        Ok(ExitCode::from(1))
    }
}

fn format_dur(d: std::time::Duration) -> String {
    let ms = d.as_secs_f64() * 1000.0;
    if ms < 1.0 {
        format!("{:.0}µs", d.as_micros())
    } else if ms < 1000.0 {
        format!("{ms:.1}ms")
    } else {
        format!("{:.2}s", d.as_secs_f64())
    }
}

fn where_cmd() -> ExitCode {
    use wlog_cli::ui;

    ui::banner_heading("wlog paths");

    let binary = std::env::current_exe()
        .ok()
        .map_or_else(|| "<unknown>".to_string(), |p| p.display().to_string());
    let cwd = std::env::current_dir()
        .ok()
        .map_or_else(|| "<unknown>".to_string(), |p| p.display().to_string());
    let xdg_config =
        std::env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| format!("{}/.config", home_dir()));
    let xdg_cache =
        std::env::var("XDG_CACHE_HOME").unwrap_or_else(|_| format!("{}/.cache", home_dir()));
    let xdg_data =
        std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| format!("{}/.local/share", home_dir()));
    let socket = wlog_ingest_git::default_socket_path();
    let cc_dir = wlog_ingest_cc::default_projects_dir();
    let nats = std::env::var("WLOG_NATS_URL").unwrap_or_else(|_| "<unset>".to_string());
    let db = std::env::var("WLOG_DATABASE_URL").unwrap_or_else(|_| "<unset>".to_string());

    let rows: Vec<(&str, String)> = vec![
        ("binary", binary),
        ("cwd", cwd),
        ("config dir", format!("{xdg_config}/wlog")),
        ("cache dir", format!("{xdg_cache}/wlog")),
        ("data dir", format!("{xdg_data}/wlog")),
        ("daemon socket", socket.display().to_string()),
        ("cc projects", cc_dir.display().to_string()),
        ("WLOG_NATS_URL", nats),
        ("WLOG_DATABASE_URL", redact_url(&db)),
    ];

    ui::kv_table(&rows);
    ExitCode::SUCCESS
}

fn redact_url(raw: &str) -> String {
    if raw == "<unset>" {
        return raw.to_string();
    }
    if let Some((scheme, rest)) = raw.split_once("://")
        && let Some(at) = rest.find('@')
        && let Some((user, _pw)) = rest[..at].split_once(':')
    {
        return format!("{scheme}://{user}:***@{}", &rest[at + 1..]);
    }
    raw.to_string()
}

fn home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
}

fn about_cmd() -> ExitCode {
    use wlog_cli::ui;

    ui::banner_heading("wlog about");

    let rows: Vec<(&str, String)> = vec![
        ("version", env!("CARGO_PKG_VERSION").to_string()),
        ("name", env!("CARGO_PKG_NAME").to_string()),
        ("description", env!("CARGO_PKG_DESCRIPTION").to_string()),
        ("license", env!("CARGO_PKG_LICENSE").to_string()),
        ("repository", env!("CARGO_PKG_REPOSITORY").to_string()),
        (
            "target",
            std::env::consts::ARCH.to_string() + "-" + std::env::consts::OS,
        ),
        (
            "rustc (build)",
            option_env!("RUSTC_VERSION")
                .unwrap_or("unknown")
                .to_string(),
        ),
        ("os family", std::env::consts::FAMILY.to_string()),
    ];
    ui::kv_table(&rows);

    println!();
    println!("{}", ui::dim("Detailed environment: run `wlog doctor`."));
    ExitCode::SUCCESS
}

async fn doctor_cmd(config_path: Option<&std::path::Path>, offline: bool) -> Result<ExitCode> {
    use wlog_cli::ui;

    ui::banner_heading("wlog doctor");

    // Section 1: identity
    ui::section("identity");
    ui::kv("version", env!("CARGO_PKG_VERSION"));
    ui::kv(
        "target",
        format!("{}-{}", std::env::consts::ARCH, std::env::consts::OS),
    );
    ui::kv(
        "binary",
        std::env::current_exe()
            .map_or_else(|_| "<unknown>".to_string(), |p| p.display().to_string()),
    );
    ui::kv("pid", std::process::id());

    // Section 2: components (re-run status checks)
    ui::section("components");
    let status_exit = status_cmd(config_path, offline, offline, None).await?;

    // Section 3: docker (best-effort)
    ui::section("docker");
    match tokio::process::Command::new("docker")
        .arg("ps")
        .arg("--filter")
        .arg("name=wlog")
        .arg("--format")
        .arg("{{.Names}}\t{{.Status}}")
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let trimmed = text.trim();
            if trimmed.is_empty() {
                ui::line(ui::Status::Neutral, "containers", "none matching `wlog`");
            } else {
                let mut table = ui::table(&["NAME", "STATUS"]);
                for ln in trimmed.lines() {
                    let mut parts = ln.split('\t');
                    let name = parts.next().unwrap_or("").to_string();
                    let st = parts.next().unwrap_or("").to_string();
                    table.add_row(vec![name, st]);
                }
                println!("{table}");
            }
        }
        Ok(_) | Err(_) => {
            ui::line(ui::Status::Neutral, "containers", "docker not available");
        }
    }

    // Section 4: footer
    println!();
    ui::divider();
    if status_exit == ExitCode::SUCCESS {
        ui::success("doctor: all green.");
        Ok(ExitCode::SUCCESS)
    } else {
        ui::warning("doctor: see hints above");
        Ok(status_exit)
    }
}

async fn admin_cmd(action: AdminAction) -> Result<ExitCode> {
    match action {
        AdminAction::Users {
            database_url,
            limit,
        } => admin_users(database_url, limit).await,
        AdminAction::Workspaces {
            database_url,
            limit,
        } => admin_workspaces(database_url, limit).await,
        AdminAction::Tail {
            nats_url,
            subject,
            max_body,
        } => admin_tail(nats_url, subject, max_body).await,
        AdminAction::Replay {
            database_url,
            nats_url,
            workspace,
            limit,
            dry_run,
        } => admin_replay(database_url, nats_url, workspace, limit, dry_run).await,
    }
}

fn resolve_admin_db_url(explicit: Option<String>) -> Result<String> {
    if let Some(u) = explicit {
        return Ok(u);
    }
    if let Ok(u) = std::env::var("WLOG_ADMIN_DATABASE_URL") {
        return Ok(u);
    }
    if let Ok(u) = std::env::var("WLOG_DATABASE_URL") {
        return Ok(u);
    }
    Err(anyhow!(
        "no database URL; pass --database-url, WLOG_ADMIN_DATABASE_URL, or WLOG_DATABASE_URL"
    ))
}

async fn log_cmd(
    config_path: Option<&std::path::Path>,
    limit: i64,
    kind_filter: Option<String>,
    all_workspaces: bool,
) -> Result<ExitCode> {
    use wlog_cli::ui;

    // Pick the DB URL + the workspace scope.
    let (pool, workspace_id) = if all_workspaces {
        let url = resolve_admin_db_url(None)?;
        let p = connect(&StorageConfig {
            url,
            max_connections: 2,
        })
        .await?;
        (p, None)
    } else {
        match config::load(config_path) {
            Ok(loaded) => {
                let p = connect(&StorageConfig {
                    url: loaded.config.storage.url.clone(),
                    max_connections: 2,
                })
                .await?;
                (p, Some(loaded.config.workspace.workspace_id()))
            }
            Err(ConfigError::NotFound) => {
                ui::error("no wlog.toml; run `wlog init` or pass --all-workspaces");
                return Ok(ExitCode::from(1));
            }
            Err(e) => return Err(e.into()),
        }
    };
    let events = EventRepo::new(pool)
        .list_recent(workspace_id, limit)
        .await?;

    let filter_lower = kind_filter.as_deref().map(str::to_lowercase);
    let mut filtered = events;
    if let Some(ref f) = filter_lower {
        filtered.retain(|e| {
            let label = format!(
                "{}.{}",
                wlog_storage::event_source_str(e.source),
                e.kind.as_str()
            );
            label.to_lowercase().contains(f.as_str())
        });
    }

    ui::banner_heading(if all_workspaces {
        "events (all)"
    } else {
        "events"
    });
    let mut table = ui::table(&["WHEN", "SOURCE", "KIND", "ID"]);
    for e in &filtered {
        let when = e.occurred_at.format("%Y-%m-%d %H:%M:%S UTC").to_string();
        let id_short = e.id.to_string();
        let id_render = &id_short[..8];
        table.add_row(vec![
            when,
            wlog_storage::event_source_str(e.source).to_string(),
            e.kind.as_str().to_string(),
            id_render.to_string(),
        ]);
    }
    println!("{table}");
    println!();
    println!(
        "{} {}",
        ui::bold(&filtered.len().to_string()),
        ui::dim("events shown")
    );
    Ok(ExitCode::SUCCESS)
}

async fn tree_cmd(
    config_path: Option<&std::path::Path>,
    raw_id: String,
    max_depth: usize,
) -> Result<ExitCode> {
    use wlog_cli::ui;

    let loaded = match config::load(config_path) {
        Ok(l) => l,
        Err(ConfigError::NotFound) => {
            ui::error("no wlog.toml; run `wlog init`");
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

    let root = match resolve_task_id(&tasks, &loaded.config.workspace, &raw_id).await? {
        ResolvedId::Single(id) => id,
        ResolvedId::Missing => {
            ui::error(format!("no task matches `{raw_id}`"));
            return Ok(ExitCode::from(1));
        }
        ResolvedId::Ambiguous(matches) => {
            ui::error(format!("ambiguous id `{raw_id}`"));
            for tid in matches {
                ui::hint(tid.short());
            }
            return Ok(ExitCode::from(1));
        }
    };

    ui::banner_heading("task tree");
    let mut visited: std::collections::HashSet<TaskId> = std::collections::HashSet::new();
    walk_tree(
        &tasks,
        &edges,
        root,
        &mut visited,
        &mut Vec::new(),
        max_depth,
        true,
    )
    .await?;
    Ok(ExitCode::SUCCESS)
}

#[allow(clippy::too_many_arguments)]
fn walk_tree<'a>(
    tasks: &'a TaskRepo,
    edges: &'a EdgeRepo,
    task: TaskId,
    visited: &'a mut std::collections::HashSet<TaskId>,
    prefix_stack: &'a mut Vec<bool>,
    max_depth: usize,
    is_last_sibling: bool,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
    Box::pin(async move {
        use wlog_cli::ui;

        if !visited.insert(task) {
            // Already rendered; mark as cycle and stop.
            render_tree_line(
                prefix_stack,
                is_last_sibling,
                &ui::dim(&format!("↻ {} (cycle)", task.short())),
            );
            return Ok(());
        }
        let node = match tasks.get(task).await {
            Ok(n) => n,
            Err(StorageError::NotFound) => {
                render_tree_line(
                    prefix_stack,
                    is_last_sibling,
                    &ui::dim(&format!("{} (missing)", task.short())),
                );
                return Ok(());
            }
            Err(e) => return Err(e.into()),
        };
        let label = format_task_label(&node);
        render_tree_line(prefix_stack, is_last_sibling, &label);

        if prefix_stack.len() >= max_depth {
            // Depth cap; show truncation marker if outgoing exists.
            let outgoing = edges.outgoing(task).await?;
            if !outgoing.is_empty() {
                prefix_stack.push(!is_last_sibling);
                render_tree_line(
                    prefix_stack,
                    true,
                    &ui::dim(&format!("… ({} more, depth cap)", outgoing.len())),
                );
                prefix_stack.pop();
            }
            return Ok(());
        }

        let outgoing = edges.outgoing(task).await?;
        let len = outgoing.len();
        for (i, edge) in outgoing.into_iter().enumerate() {
            let last = i + 1 == len;
            prefix_stack.push(!is_last_sibling);
            walk_tree(
                tasks,
                edges,
                edge.to_task,
                visited,
                prefix_stack,
                max_depth,
                last,
            )
            .await?;
            prefix_stack.pop();
        }
        Ok(())
    })
}

fn render_tree_line(prefix_stack: &[bool], is_last_sibling: bool, label: &str) {
    use wlog_cli::ui;
    let mut prefix = String::new();
    if !prefix_stack.is_empty() {
        for &continuing in &prefix_stack[..prefix_stack.len() - 1] {
            prefix.push_str(if continuing { "│   " } else { "    " });
        }
        prefix.push_str(if is_last_sibling {
            "└── "
        } else {
            "├── "
        });
    }
    println!("{}{}", ui::dim(&prefix), label);
}

fn format_task_label(node: &wlog_proto::TaskNode) -> String {
    use wlog_cli::ui;
    let status_sym = match node.status {
        TaskStatus::Acked => ui::green("✓"),
        TaskStatus::Rejected => ui::red("✗"),
        TaskStatus::InProgress => ui::info("●"),
        TaskStatus::Done => ui::green("●"),
        TaskStatus::Proposed => ui::dim("○"),
    };
    let node_kind = match node.node_type {
        NodeType::Intent => "intent",
        NodeType::Decomposition => "decomp",
        NodeType::Execution => "exec",
        NodeType::Outcome => "outcome",
    };
    format!(
        "{status_sym} {short}  {kind}  {title}",
        short = ui::bold(&node.id.short()),
        kind = ui::dim(node_kind),
        title = node.title
    )
}

async fn admin_users(database_url: Option<String>, limit: i64) -> Result<ExitCode> {
    use wlog_cli::ui;

    let url = resolve_admin_db_url(database_url)?;
    let pool = connect(&StorageConfig {
        url,
        max_connections: 2,
    })
    .await?;
    let users = UserRepo::new(pool.clone());
    let workspaces = WorkspaceRepo::new(pool);

    let ws_index: std::collections::HashMap<_, _> = workspaces
        .list(1000)
        .await?
        .into_iter()
        .map(|w| (w.id, w.slug))
        .collect();

    let rows = users.list_all(limit).await?;
    ui::banner_heading("users");

    let mut table = ui::table(&["WORKSPACE", "HANDLE", "EMAIL", "CREATED"]);
    for u in &rows {
        let ws = ws_index
            .get(&u.workspace_id)
            .cloned()
            .unwrap_or_else(|| "<orphan>".to_string());
        let email = u.email.as_deref().unwrap_or("-");
        let created = u.created_at.format("%Y-%m-%d %H:%M UTC").to_string();
        table.add_row(vec![ws, u.handle.clone(), email.to_string(), created]);
    }
    println!("{table}");
    println!();
    println!(
        "{} {}",
        ui::bold(&rows.len().to_string()),
        ui::dim("users total")
    );
    Ok(ExitCode::SUCCESS)
}

async fn admin_workspaces(database_url: Option<String>, limit: i64) -> Result<ExitCode> {
    use wlog_cli::ui;

    let url = resolve_admin_db_url(database_url)?;
    let pool = connect(&StorageConfig {
        url,
        max_connections: 1,
    })
    .await?;
    let workspaces = WorkspaceRepo::new(pool);

    let rows = workspaces.list(limit).await?;
    ui::banner_heading("workspaces");

    let mut table = ui::table(&["SLUG", "NAME", "CREATED"]);
    for w in &rows {
        let created = w.created_at.format("%Y-%m-%d %H:%M UTC").to_string();
        table.add_row(vec![w.slug.clone(), w.name.clone(), created]);
    }
    println!("{table}");
    println!();
    println!(
        "{} {}",
        ui::bold(&rows.len().to_string()),
        ui::dim("workspaces total")
    );
    Ok(ExitCode::SUCCESS)
}

async fn admin_tail(nats_url: String, subject: String, max_body: usize) -> Result<ExitCode> {
    use futures::StreamExt;
    use wlog_cli::ui;

    let client = async_nats::connect(&nats_url)
        .await
        .with_context(|| format!("connecting to NATS at {nats_url}"))?;
    let mut sub = client
        .subscribe(subject.clone())
        .await
        .with_context(|| format!("subscribing to {subject}"))?;

    ui::banner_heading("admin tail");
    ui::kv("subject", &subject);
    ui::kv("nats", &nats_url);
    ui::kv("max-body", max_body);
    println!();
    println!("{}", ui::dim("Ctrl-C to exit"));
    ui::divider();

    let ctrl_c = tokio::signal::ctrl_c();
    tokio::pin!(ctrl_c);
    let mut count: u64 = 0;

    loop {
        tokio::select! {
            biased;
            _ = &mut ctrl_c => {
                println!();
                ui::warning(format!("interrupted after {count} message(s)"));
                break;
            }
            msg = sub.next() => {
                let Some(msg) = msg else { break };
                count += 1;
                let ts = chrono::Utc::now().format("%H:%M:%S%.3f");
                let body_len = msg.payload.len();
                let body_str = String::from_utf8_lossy(&msg.payload);
                let trimmed: String = if body_str.len() > max_body {
                    format!("{}{}", &body_str[..max_body], ui::dim(&format!("…({body_len}B)")))
                } else {
                    body_str.into_owned()
                };
                println!(
                    "{ts_col}  {subj}  {body}",
                    ts_col = ui::dim(&ts.to_string()),
                    subj = ui::info(msg.subject.as_ref()),
                    body = trimmed
                );
            }
        }
    }
    Ok(ExitCode::SUCCESS)
}

async fn admin_replay(
    database_url: Option<String>,
    nats_url: String,
    workspace_slug: Option<String>,
    limit: i64,
    dry_run: bool,
) -> Result<ExitCode> {
    use wlog_cli::ui;

    let url = resolve_admin_db_url(database_url)?;
    let pool = connect(&StorageConfig {
        url,
        max_connections: 2,
    })
    .await?;

    let workspace = if let Some(slug) = workspace_slug.as_deref() {
        Some(WorkspaceRepo::new(pool.clone()).get_by_slug(slug).await?)
    } else {
        None
    };

    let events = EventRepo::new(pool.clone())
        .list_recent(workspace.as_ref().map(|w| w.id), limit)
        .await?;

    ui::banner_heading("admin replay");
    ui::kv(
        "workspace",
        workspace.as_ref().map_or("(all)", |w| w.slug.as_str()),
    );
    ui::kv("events", events.len());
    ui::kv("nats", &nats_url);
    ui::kv("mode", if dry_run { "dry-run" } else { "live" });
    println!();

    if dry_run {
        let mut table = ui::table(&["WHEN", "SUBJECT", "BYTES"]);
        for e in &events {
            let subj = replay_subject(e, workspace_slug.as_deref());
            let when = e.occurred_at.format("%Y-%m-%d %H:%M:%S UTC").to_string();
            let body = serde_json::to_vec(&e.payload).unwrap_or_default();
            table.add_row(vec![when, subj, body.len().to_string()]);
        }
        println!("{table}");
        ui::warning("dry-run; nothing was published");
        return Ok(ExitCode::SUCCESS);
    }

    let client = async_nats::connect(&nats_url)
        .await
        .with_context(|| format!("connecting to {nats_url}"))?;
    let mut published = 0u64;
    for e in &events {
        let subj = replay_subject(e, workspace_slug.as_deref());
        let body = serde_json::to_vec(&e.payload)?;
        client
            .publish(subj.clone(), body.into())
            .await
            .with_context(|| format!("publish {subj}"))?;
        published += 1;
    }
    client.flush().await.context("flush after replay")?;
    println!(
        "{} {}",
        ui::bold(&published.to_string()),
        ui::dim("events replayed")
    );
    Ok(ExitCode::SUCCESS)
}

fn replay_subject(event: &wlog_proto::Event, fallback_slug: Option<&str>) -> String {
    let workspace = fallback_slug.unwrap_or("replay");
    let src = wlog_storage::event_source_str(event.source);
    format!(
        "wlog.{workspace}.event.{src}.{kind}",
        kind = event.kind.as_str()
    )
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

    let matches: Vec<wlog_proto::TaskNode> = if let Ok(api_key) = std::env::var("OPENAI_API_KEY")
        && !api_key.is_empty()
    {
        use wlog_engine::embed::{EmbeddingProvider, OpenAiEmbedder, OpenAiEmbedderConfig};
        let embedder = OpenAiEmbedder::new(OpenAiEmbedderConfig::from_api_key(api_key))?;
        let batch = embedder.embed_batch(&[query.as_str()]).await?;
        let qv = batch.vectors.into_iter().next().unwrap_or_default();
        let hits = tasks
            .find_similar(loaded.config.workspace.workspace_id(), qv, limit)
            .await?;
        if hits.is_empty() {
            eprintln!("no embedded tasks yet; populate embeddings then retry");
        }
        hits.into_iter().map(|(t, _)| t).collect()
    } else {
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
        rows.into_iter()
            .filter(|t| {
                t.title.to_lowercase().contains(&needle)
                    || t.body
                        .as_deref()
                        .is_some_and(|b| b.to_lowercase().contains(&needle))
            })
            .take(usize::try_from(limit).unwrap_or(10))
            .collect()
    };
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
            {
                let mut stdout = std::io::stdout().lock();
                let _ = banner::print_banner(&mut stdout, banner::should_color());
            }
            println!();
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
    let mut stdout = std::io::stdout().lock();
    let _ = banner::print_banner(&mut stdout, banner::should_color());
    drop(stdout);
    println!();

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
    {
        use wlog_cli::ui;
        ui::section("workspace ready");
        ui::kv("slug", &cfg.workspace.slug);
        ui::kv("id", workspace.id.0);
        ui::kv("user", &cfg.workspace.user_handle);
        ui::kv("config", written.display());
        println!();
        ui::success("workspace bootstrapped");
        println!();
        println!("{}", ui::dim("Next steps:"));
        println!("  {} wlog hooks install", ui::info("→"));
        println!("  {} wlog daemon run", ui::info("→"));
        println!("  {} wlog status", ui::info("→"));
    }
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
    let tasks = TaskRepo::new(pool.clone());
    let edits_repo = wlog_storage::TaskEditRepo::new(pool.clone());
    let users_repo = UserRepo::new(pool);
    let me = users_repo
        .get_by_handle(
            loaded.config.workspace.workspace_id(),
            &loaded.config.workspace.user_handle,
        )
        .await
        .ok()
        .map(|u| u.id);
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
        let current = tasks.get(tid).await?;
        let updated = tasks.set_status(tid, TaskStatus::Rejected).await?;
        let _ = edits_repo
            .create(wlog_storage::NewTaskEdit {
                workspace_id: loaded.config.workspace.workspace_id(),
                task_id: tid,
                editor: me,
                field: "status".into(),
                before: Some(current.status.as_str().to_string()),
                after: Some(TaskStatus::Rejected.as_str().to_string()),
            })
            .await;
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
        let after = tasks
            .update_text(tid, &edited.title, edited.body.as_deref())
            .await?;
        if current.title != after.title {
            let _ = edits_repo
                .create(wlog_storage::NewTaskEdit {
                    workspace_id: loaded.config.workspace.workspace_id(),
                    task_id: tid,
                    editor: me,
                    field: "title".into(),
                    before: Some(current.title.clone()),
                    after: Some(after.title.clone()),
                })
                .await;
        }
        if current.body != after.body {
            let _ = edits_repo
                .create(wlog_storage::NewTaskEdit {
                    workspace_id: loaded.config.workspace.workspace_id(),
                    task_id: tid,
                    editor: me,
                    field: "body".into(),
                    before: current.body.clone(),
                    after: after.body.clone(),
                })
                .await;
        }
    }
    let before = tasks.get(tid).await?;
    let updated = tasks.set_status(tid, TaskStatus::Acked).await?;
    if before.status != TaskStatus::Acked {
        let _ = edits_repo
            .create(wlog_storage::NewTaskEdit {
                workspace_id: loaded.config.workspace.workspace_id(),
                task_id: tid,
                editor: me,
                field: "status".into(),
                before: Some(before.status.as_str().to_string()),
                after: Some(TaskStatus::Acked.as_str().to_string()),
            })
            .await;
    }
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
