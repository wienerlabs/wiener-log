//! LLM cost ledger and ceiling guard.
//!
//! Mandate §2.6 imposes a hard daily ceiling ($15 USD by default) and a
//! rolling 7-day ceiling ($75 USD). Every call to an [`LlmClient`] is
//! appended to a per-day JSONL ledger under `reports/cost/`; once a day's
//! cumulative spend exceeds the cap, [`CostGuard`] short-circuits
//! further calls with [`LlmError::CostCeilingExceeded`].

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::llm::{CompletionRequest, CompletionResponse, LlmClient, LlmError, Usage};

/// Default hard caps. The values match mandate §2.6 verbatim.
pub const DEFAULT_DAILY_CAP_USD: f64 = 15.0;
/// Days included in the rolling-window check.
pub const DEFAULT_ROLLING_WINDOW_DAYS: u32 = 7;
/// Rolling cap that pairs with [`DEFAULT_ROLLING_WINDOW_DAYS`].
pub const DEFAULT_ROLLING_CAP_USD: f64 = 75.0;

/// One row written into the daily ledger.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    /// When the call completed.
    pub timestamp: DateTime<Utc>,
    /// Purpose tag (`synthesis`, `triage`, `embedding`, ...).
    pub purpose: String,
    /// Model billed.
    pub model: String,
    /// Token accounting reproduced from the upstream usage block.
    pub usage: Usage,
    /// USD estimate at the time of the call.
    pub usd: f64,
}

/// Ceiling configuration. Construct one per workspace; defaults match
/// the mandate.
#[derive(Debug, Clone)]
pub struct CeilingPolicy {
    /// Hard cap for spend within a single UTC day.
    pub daily_cap_usd: f64,
    /// Window size for the rolling-cap check.
    pub rolling_window_days: u32,
    /// Hard cap for spend across the rolling window.
    pub rolling_cap_usd: f64,
}

impl Default for CeilingPolicy {
    fn default() -> Self {
        Self {
            daily_cap_usd: DEFAULT_DAILY_CAP_USD,
            rolling_window_days: DEFAULT_ROLLING_WINDOW_DAYS,
            rolling_cap_usd: DEFAULT_ROLLING_CAP_USD,
        }
    }
}

/// Filesystem-backed ledger. Thread-safe; one writer process at a time.
#[derive(Debug, Clone)]
pub struct CostLedger {
    root: PathBuf,
    lock: Arc<Mutex<()>>,
}

impl CostLedger {
    /// Construct a ledger that writes under `root` (typically
    /// `reports/cost`).
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            lock: Arc::new(Mutex::new(())),
        }
    }

    /// Append one entry to the ledger file for `entry.timestamp`'s UTC
    /// date. Creates the directory and file on demand.
    pub fn append(&self, entry: &LedgerEntry) -> io::Result<()> {
        let _guard = self
            .lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        fs::create_dir_all(&self.root)?;
        let path = self.file_for(entry.timestamp.date_naive());
        let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
        let mut line = serde_json::to_string(entry)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        line.push('\n');
        file.write_all(line.as_bytes())?;
        Ok(())
    }

    /// Sum of USD spent on `date`.
    pub fn total_for_day(&self, date: NaiveDate) -> io::Result<f64> {
        let entries = self.read_day(date)?;
        Ok(entries.iter().map(|e| e.usd).sum())
    }

    /// Sum of USD spent over the past `window` days, inclusive of today.
    pub fn rolling_total(&self, today: NaiveDate, window: u32) -> io::Result<f64> {
        let mut total = 0.0;
        for offset in 0..i64::from(window) {
            let date = today - chrono::Duration::days(offset);
            total += self.total_for_day(date)?;
        }
        Ok(total)
    }

    /// Read every entry recorded on `date`.
    pub fn read_day(&self, date: NaiveDate) -> io::Result<Vec<LedgerEntry>> {
        let path = self.file_for(date);
        match fs::read_to_string(&path) {
            Ok(text) => {
                let mut out = Vec::new();
                for line in text.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<LedgerEntry>(line) {
                        Ok(entry) => out.push(entry),
                        Err(e) => tracing::warn!(error = %e, "skipping malformed ledger row"),
                    }
                }
                Ok(out)
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Filesystem path for a given date's ledger.
    pub fn file_for(&self, date: NaiveDate) -> PathBuf {
        self.root.join(format!("{date}.jsonl"))
    }

    /// Root directory holding the daily ledgers.
    pub fn root(&self) -> &Path {
        &self.root
    }
}

/// Guard that wraps an [`LlmClient`], enforces the cost ceilings, and
/// records each call into the ledger.
pub struct CostGuard<C: LlmClient> {
    inner: C,
    ledger: CostLedger,
    policy: CeilingPolicy,
    purpose: String,
}

impl<C: LlmClient> std::fmt::Debug for CostGuard<C> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CostGuard")
            .field("purpose", &self.purpose)
            .field("policy", &self.policy)
            .finish_non_exhaustive()
    }
}

impl<C: LlmClient> CostGuard<C> {
    /// Wrap `inner` with the given ledger and policy. `purpose` is the
    /// tag written into every ledger row.
    pub fn new(
        inner: C,
        ledger: CostLedger,
        policy: CeilingPolicy,
        purpose: impl Into<String>,
    ) -> Self {
        Self {
            inner,
            ledger,
            policy,
            purpose: purpose.into(),
        }
    }

    fn check_ceilings(&self, now: DateTime<Utc>) -> Result<(), LlmError> {
        let today = now.date_naive();
        let daily = self
            .ledger
            .total_for_day(today)
            .map_err(|e| LlmError::Transport(format!("cost ledger read: {e}")))?;
        if daily >= self.policy.daily_cap_usd {
            tracing::warn!(daily, cap = self.policy.daily_cap_usd, "daily ceiling hit");
            return Err(LlmError::CostCeilingExceeded);
        }
        let rolling = self
            .ledger
            .rolling_total(today, self.policy.rolling_window_days)
            .map_err(|e| LlmError::Transport(format!("cost ledger read: {e}")))?;
        if rolling >= self.policy.rolling_cap_usd {
            tracing::warn!(
                rolling,
                cap = self.policy.rolling_cap_usd,
                "rolling ceiling hit"
            );
            return Err(LlmError::CostCeilingExceeded);
        }
        Ok(())
    }
}

#[async_trait]
impl<C: LlmClient> LlmClient for CostGuard<C> {
    fn name(&self) -> &'static str {
        self.inner.name()
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LlmError> {
        let now = Utc::now();
        self.check_ceilings(now)?;
        let response = self.inner.complete(request).await?;
        let usd = response.usage.estimate_usd();
        let entry = LedgerEntry {
            timestamp: now,
            purpose: self.purpose.clone(),
            model: response.usage.model.clone(),
            usage: response.usage.clone(),
            usd,
        };
        if let Err(e) = self.ledger.append(&entry) {
            tracing::warn!(error = %e, "cost ledger append failed");
        }
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use crate::llm::{Message, MockLlmClient, Role};

    use super::*;

    fn mock_request() -> CompletionRequest {
        CompletionRequest {
            model: "mock".into(),
            system: None,
            cache_system: false,
            messages: vec![Message {
                role: Role::User,
                content: "ping".into(),
                cache: false,
            }],
            max_tokens: 10,
            temperature: None,
        }
    }

    #[tokio::test]
    async fn append_and_total_round_trip() {
        let tmp = tempdir::TempDir::new("wlog-ledger").unwrap();
        let ledger = CostLedger::new(tmp.path());
        let now = Utc::now();
        let entry = LedgerEntry {
            timestamp: now,
            purpose: "synthesis".into(),
            model: "claude-sonnet-4-6".into(),
            usage: Usage {
                model: "claude-sonnet-4-6".into(),
                input_tokens: 1_000_000,
                output_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
            },
            usd: 3.0,
        };
        ledger.append(&entry).unwrap();
        let today = now.date_naive();
        assert!((ledger.total_for_day(today).unwrap() - 3.0).abs() < 1e-9);
    }

    #[tokio::test]
    async fn guard_records_each_call() {
        let tmp = tempdir::TempDir::new("wlog-ledger-guard").unwrap();
        let ledger = CostLedger::new(tmp.path());
        let mock = MockLlmClient::default();
        let guard = CostGuard::new(mock, ledger.clone(), CeilingPolicy::default(), "synthesis");
        let resp = guard.complete(mock_request()).await.unwrap();
        assert_eq!(resp.content, "(mock completion)");
        let entries = ledger.read_day(Utc::now().date_naive()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].purpose, "synthesis");
    }

    #[tokio::test]
    async fn guard_short_circuits_at_ceiling() {
        let tmp = tempdir::TempDir::new("wlog-ledger-ceiling").unwrap();
        let ledger = CostLedger::new(tmp.path());
        // Pre-seed the day above the cap.
        let now = Utc::now();
        ledger
            .append(&LedgerEntry {
                timestamp: now,
                purpose: "manual".into(),
                model: "x".into(),
                usage: Usage::default(),
                usd: 16.0,
            })
            .unwrap();
        let mock = MockLlmClient::default();
        let guard = CostGuard::new(
            mock,
            ledger,
            CeilingPolicy {
                daily_cap_usd: 15.0,
                ..CeilingPolicy::default()
            },
            "synthesis",
        );
        let result = guard.complete(mock_request()).await;
        assert!(matches!(result, Err(LlmError::CostCeilingExceeded)));
    }
}
