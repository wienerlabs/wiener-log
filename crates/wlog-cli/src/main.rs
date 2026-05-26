//! `wlog` command line entry point.

#![warn(missing_docs)]

mod config;
mod output;

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{Context, Result, anyhow};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;
use wlog_proto::{NodeType, TaskId, TaskStatus};
use wlog_storage::{
    EdgeRepo, NewTask, NewUser, NewWorkspace, StorageConfig, StorageError, TaskListFilter,
    TaskRepo, UserRepo, WorkspaceRepo, connect, healthcheck, migrate,
};

use crate::config::{Config, ConfigError, StorageSection, WorkspaceConfig};
use crate::output::Format;

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
    }
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
