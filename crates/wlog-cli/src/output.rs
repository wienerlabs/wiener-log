//! Output formatting for CLI subcommands.

use std::io::{self, Write};

use serde::Serialize;
use wlog_proto::TaskNode;

/// User-selectable output formats.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum Format {
    /// Plain text table for human reading.
    #[default]
    Table,
    /// One JSON object per line.
    Json,
    /// Tab-separated values for spreadsheet paste.
    Tsv,
}

/// Write a slice of tasks in the requested format.
pub fn print_tasks<W: Write>(out: &mut W, tasks: &[TaskNode], format: Format) -> io::Result<()> {
    match format {
        Format::Table => write_table(out, tasks),
        Format::Json => write_json(out, tasks),
        Format::Tsv => write_tsv(out, tasks),
    }
}

fn write_table<W: Write>(out: &mut W, tasks: &[TaskNode]) -> io::Result<()> {
    let header = format!(
        "{:<8}  {:<10}  {:<14}  {:<7}  {:<24}  TITLE",
        "ID", "STATUS", "TYPE", "REPO", "UPDATED"
    );
    writeln!(out, "{header}")?;
    let rule = "-".repeat(100);
    writeln!(out, "{rule}")?;
    for task in tasks {
        let id = task.id.short();
        let status = task.status.as_str();
        let nt = task.node_type.as_str();
        let repo = task.repo.as_deref().unwrap_or("-");
        let updated = task.updated_at.format("%Y-%m-%d %H:%M:%S%z").to_string();
        let title = truncate(&task.title, 60);
        writeln!(
            out,
            "{id:<8}  {status:<10}  {nt:<14}  {repo:<7}  {updated:<24}  {title}"
        )?;
    }
    Ok(())
}

fn write_json<W: Write>(out: &mut W, tasks: &[TaskNode]) -> io::Result<()> {
    for task in tasks {
        let json = serde_json::to_string(&JsonTask::from(task))
            .map_err(|e| io::Error::other(e.to_string()))?;
        writeln!(out, "{json}")?;
    }
    Ok(())
}

fn write_tsv<W: Write>(out: &mut W, tasks: &[TaskNode]) -> io::Result<()> {
    writeln!(out, "id\tstatus\ttype\trepo\tupdated_at\ttitle")?;
    for task in tasks {
        writeln!(
            out,
            "{}\t{}\t{}\t{}\t{}\t{}",
            task.id.as_uuid(),
            task.status.as_str(),
            task.node_type.as_str(),
            task.repo.as_deref().unwrap_or(""),
            task.updated_at.to_rfc3339(),
            task.title.replace('\t', " "),
        )?;
    }
    Ok(())
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max - 1).collect();
        out.push('…');
        out
    }
}

#[derive(Serialize)]
struct JsonTask<'a> {
    id: String,
    short_id: String,
    workspace_id: String,
    node_type: &'a str,
    status: &'a str,
    title: &'a str,
    body: Option<&'a str>,
    repo: Option<&'a str>,
    owner: Option<String>,
    embedding_present: bool,
    created_at: String,
    updated_at: String,
}

impl<'a> From<&'a TaskNode> for JsonTask<'a> {
    fn from(t: &'a TaskNode) -> Self {
        Self {
            id: t.id.as_uuid().to_string(),
            short_id: t.id.short(),
            workspace_id: t.workspace_id.as_uuid().to_string(),
            node_type: t.node_type.as_str(),
            status: t.status.as_str(),
            title: &t.title,
            body: t.body.as_deref(),
            repo: t.repo.as_deref(),
            owner: t.owner.map(|u| u.as_uuid().to_string()),
            embedding_present: t.embedding_present,
            created_at: t.created_at.to_rfc3339(),
            updated_at: t.updated_at.to_rfc3339(),
        }
    }
}
