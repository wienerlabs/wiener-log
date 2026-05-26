//! NATS JetStream consumer that drains `wlog.{ws}.event.>` into the
//! `events` table.
//!
//! Phase 1 #30. The consumer:
//!
//! 1. Ensures the `WLOG_EVENTS` JetStream stream exists (subjects =
//!    `wlog.*.event.>`, file storage, 30-day retention per ADR-0007).
//! 2. Creates a durable pull consumer (default name
//!    `engine-consumer-default`) so restarts resume at the last
//!    acknowledged sequence.
//! 3. For every message: parses the subject into workspace slug +
//!    source + kind, looks up the workspace UUID through
//!    [`WorkspaceCache`], persists the event via [`EventRepo`], and
//!    acknowledges the JetStream message.
//!
//! Workspaces that disappear (or arrive without a row in `workspaces`)
//! get the message NAK'd; the consumer retries later.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use async_nats::jetstream;
use async_nats::jetstream::stream::{Config as StreamConfig, RetentionPolicy, StorageType};
use chrono::Utc;
use futures::StreamExt;
use tokio::sync::{Mutex, Notify};
use uuid::Uuid;
use wlog_proto::{Event, EventKind, EventSource, WorkspaceId};
use wlog_storage::{EventRepo, WorkspaceRepo};

/// Default stream name (ADR-0007 §"JetStream streams").
pub const DEFAULT_STREAM: &str = "WLOG_EVENTS";
/// Default durable consumer name.
pub const DEFAULT_CONSUMER: &str = "engine-consumer-default";

/// Configuration for [`run`].
#[derive(Debug, Clone)]
pub struct ConsumerConfig {
    /// NATS endpoint.
    pub nats_url: String,
    /// Subject filter; defaults to `wlog.*.event.>`.
    pub subject_filter: String,
    /// Stream name to create / use.
    pub stream: String,
    /// Durable consumer name.
    pub durable: String,
    /// Retention horizon for the events stream.
    pub max_age: Duration,
}

impl Default for ConsumerConfig {
    fn default() -> Self {
        Self {
            nats_url: "nats://127.0.0.1:4222".to_string(),
            subject_filter: "wlog.*.event.>".to_string(),
            stream: DEFAULT_STREAM.to_string(),
            durable: DEFAULT_CONSUMER.to_string(),
            max_age: Duration::from_secs(30 * 24 * 60 * 60),
        }
    }
}

/// Caches workspace slug -> UUID lookups so we hit Postgres at most
/// once per slug for the lifetime of the consumer.
#[derive(Debug, Default)]
pub struct WorkspaceCache {
    inner: Mutex<HashMap<String, WorkspaceId>>,
}

impl WorkspaceCache {
    /// Empty cache.
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Resolve `slug` to a `WorkspaceId`, hitting the repo on miss.
    pub async fn resolve(
        &self,
        slug: &str,
        workspaces: &WorkspaceRepo,
    ) -> Result<Option<WorkspaceId>> {
        if let Some(id) = self.inner.lock().await.get(slug).copied() {
            return Ok(Some(id));
        }
        let ws = match workspaces.get_by_slug(slug).await {
            Ok(w) => w,
            Err(wlog_storage::StorageError::NotFound) => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        self.inner.lock().await.insert(slug.to_string(), ws.id);
        Ok(Some(ws.id))
    }
}

/// Parsed view of `wlog.{ws}.event.{source}.{kind}` subjects.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSubject {
    /// Workspace slug from the second segment.
    pub workspace_slug: String,
    /// Source taxonomy (`git`, `cc`, `gh`).
    pub source: EventSource,
    /// Event kind suffix (everything after `source`).
    pub kind: String,
}

impl ParsedSubject {
    /// Parse `wlog.{ws}.event.{source}.{kind}` (kind may contain dots).
    pub fn parse(subject: &str) -> Option<Self> {
        let mut iter = subject.split('.');
        if iter.next()? != "wlog" {
            return None;
        }
        let workspace_slug = iter.next()?.to_string();
        if iter.next()? != "event" {
            return None;
        }
        let source = match iter.next()? {
            "git" => EventSource::Git,
            "cc" => EventSource::ClaudeCode,
            "gh" => EventSource::GitHub,
            _ => return None,
        };
        let kind: String = iter.collect::<Vec<_>>().join(".");
        if kind.is_empty() {
            return None;
        }
        Some(Self {
            workspace_slug,
            source,
            kind,
        })
    }
}

/// Run the consumer loop until `shutdown` fires. Returns the number of
/// events persisted.
pub async fn run(
    config: ConsumerConfig,
    workspaces: WorkspaceRepo,
    events: EventRepo,
    shutdown: Arc<Notify>,
) -> Result<u64> {
    let client = async_nats::connect(&config.nats_url)
        .await
        .with_context(|| format!("connecting to NATS at {}", config.nats_url))?;
    let js = jetstream::new(client);

    js.get_or_create_stream(StreamConfig {
        name: config.stream.clone(),
        subjects: vec![config.subject_filter.clone()],
        retention: RetentionPolicy::Limits,
        max_age: config.max_age,
        storage: StorageType::File,
        ..Default::default()
    })
    .await
    .context("get_or_create_stream")?;

    let stream = js.get_stream(&config.stream).await?;
    let consumer = stream
        .get_or_create_consumer(
            &config.durable,
            jetstream::consumer::pull::Config {
                durable_name: Some(config.durable.clone()),
                ack_policy: jetstream::consumer::AckPolicy::Explicit,
                filter_subject: config.subject_filter.clone(),
                ..Default::default()
            },
        )
        .await
        .context("get_or_create_consumer")?;

    tracing::info!(stream = %config.stream, durable = %config.durable, "engine consumer ready");

    let cache = WorkspaceCache::new();
    let mut messages = consumer.messages().await?;
    let mut persisted: u64 = 0;

    loop {
        tokio::select! {
            biased;
            () = shutdown.notified() => {
                tracing::info!(persisted, "engine consumer shutting down");
                return Ok(persisted);
            }
            next = messages.next() => {
                let Some(item) = next else {
                    tracing::warn!("jetstream message stream ended");
                    return Ok(persisted);
                };
                let message = match item {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!(error = %e, "jetstream pull error");
                        continue;
                    }
                };
                match handle_one(&message, &cache, &workspaces, &events).await {
                    Ok(()) => {
                        if let Err(e) = message.ack().await {
                            tracing::warn!(error = %e, "ack failed");
                        }
                        persisted += 1;
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, subject = %message.subject, "persist failed; redeliver");
                        // Surface the error to redeliver later. ack_with(Nak)
                        // would be ideal; the simpler path is to skip
                        // acking which redelivers after AckWait.
                    }
                }
            }
        }
    }
}

async fn handle_one(
    message: &async_nats::jetstream::Message,
    cache: &WorkspaceCache,
    workspaces: &WorkspaceRepo,
    events: &EventRepo,
) -> Result<()> {
    let subject = message.subject.as_str();
    let parsed =
        ParsedSubject::parse(subject).with_context(|| format!("unparseable subject {subject}"))?;
    let Some(workspace_id) = cache.resolve(&parsed.workspace_slug, workspaces).await? else {
        anyhow::bail!("unknown workspace slug {}", parsed.workspace_slug);
    };
    let payload: serde_json::Value = if message.payload.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_slice(&message.payload).context("decode payload")?
    };
    let occurred_at = payload
        .get("emitted_at")
        .and_then(|v| v.as_str())
        .and_then(parse_rfc3339)
        .or_else(|| {
            payload
                .get("occurred_at")
                .and_then(|v| v.as_str())
                .and_then(parse_rfc3339)
        })
        .unwrap_or_else(Utc::now);
    let event = Event {
        id: Uuid::new_v4(),
        workspace_id,
        source: parsed.source,
        kind: EventKind::new(parsed.kind),
        payload,
        occurred_at,
    };
    events.create(&event).await?;
    Ok(())
}

fn parse_rfc3339(s: &str) -> Option<chrono::DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_git_commit_subject() {
        let p = ParsedSubject::parse("wlog.local.event.git.post-commit").unwrap();
        assert_eq!(p.workspace_slug, "local");
        assert_eq!(p.source, EventSource::Git);
        assert_eq!(p.kind, "post-commit");
    }

    #[test]
    fn parses_gh_compound_kind() {
        let p = ParsedSubject::parse("wlog.local.event.gh.pr.opened").unwrap();
        assert_eq!(p.source, EventSource::GitHub);
        assert_eq!(p.kind, "pr.opened");
    }

    #[test]
    fn rejects_wrong_prefix() {
        assert!(ParsedSubject::parse("foo.bar.baz").is_none());
        assert!(ParsedSubject::parse("wlog.x.command.synth.run").is_none());
    }
}
