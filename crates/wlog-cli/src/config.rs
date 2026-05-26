//! `wlog.toml` loading and writing.
//!
//! Lookup order:
//!   1. `--config <path>` on the CLI (handled in `main`).
//!   2. `wlog.toml` in the current working directory.
//!   3. `$WLOG_CONFIG_HOME/wlog.toml` if set.
//!   4. `$XDG_CONFIG_HOME/wlog/wlog.toml` (default `~/.config/wlog/wlog.toml`).

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;
use wlog_proto::WorkspaceId;

/// On-disk config file for a wlog workspace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Workspace section.
    pub workspace: WorkspaceConfig,
    /// Storage section.
    pub storage: StorageSection,
}

/// Workspace identity for the local CLI session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    /// Workspace UUID, set by `wlog init`.
    pub id: Uuid,
    /// URL-safe slug.
    pub slug: String,
    /// Current user's handle inside the workspace.
    pub user_handle: String,
}

impl WorkspaceConfig {
    /// Convenience: typed workspace id.
    pub const fn workspace_id(&self) -> WorkspaceId {
        WorkspaceId(self.id)
    }
}

/// Storage section of the config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSection {
    /// Postgres connection URL.
    pub url: String,
    /// Max pool size.
    #[serde(default = "default_pool_size")]
    pub max_connections: u32,
}

const fn default_pool_size() -> u32 {
    10
}

/// Errors raised by the config layer.
#[derive(Debug, Error)]
pub enum ConfigError {
    /// No config file found at any candidate path.
    #[error("no wlog.toml found; run `wlog init` first")]
    NotFound,
    /// Config exists but cannot be written without `--force`.
    #[error("config already exists at {0:?}; pass --force to overwrite")]
    AlreadyExists(PathBuf),
    /// Filesystem error.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    /// Parse error.
    #[error("toml parse error: {0}")]
    Parse(#[from] toml::de::Error),
    /// Serialization error.
    #[error("toml serialize error: {0}")]
    Serialize(#[from] toml::ser::Error),
}

/// Resolved config + the file it came from.
#[derive(Debug, Clone)]
pub struct Loaded {
    /// Parsed config.
    pub config: Config,
    /// File the config was read from.
    #[allow(
        dead_code,
        reason = "surfaced in diagnostic output once tracing-aware commands land"
    )]
    pub path: PathBuf,
}

/// Search the candidate paths and return the first existing config.
pub fn load(explicit: Option<&Path>) -> Result<Loaded, ConfigError> {
    if let Some(p) = explicit {
        let text = fs::read_to_string(p)?;
        let config: Config = toml::from_str(&text)?;
        tracing::debug!(path = %p.display(), "config loaded (explicit)");
        return Ok(Loaded {
            config,
            path: p.to_path_buf(),
        });
    }
    for candidate in candidate_paths() {
        if candidate.is_file() {
            let text = fs::read_to_string(&candidate)?;
            let config: Config = toml::from_str(&text)?;
            tracing::debug!(path = %candidate.display(), "config loaded");
            return Ok(Loaded {
                config,
                path: candidate,
            });
        }
    }
    Err(ConfigError::NotFound)
}

/// Write the config to the canonical user location.
pub fn write(config: &Config, force: bool) -> Result<PathBuf, ConfigError> {
    let target = canonical_path();
    if target.is_file() && !force {
        return Err(ConfigError::AlreadyExists(target));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let text = toml::to_string_pretty(config)?;
    fs::write(&target, text)?;
    Ok(target)
}

fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("wlog.toml"));
    }
    if let Ok(custom) = std::env::var("WLOG_CONFIG_HOME") {
        paths.push(PathBuf::from(custom).join("wlog.toml"));
    }
    paths.push(canonical_path());
    paths
}

fn canonical_path() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("wlog").join("wlog.toml");
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".config")
            .join("wlog")
            .join("wlog.toml");
    }
    PathBuf::from("./wlog.toml")
}
