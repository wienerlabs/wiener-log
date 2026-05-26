use async_trait::async_trait;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct CheckpointInput {
    pub workspace_slug: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub task_ids: Vec<String>,
    pub event_count: u64,
}

#[derive(Debug, Clone)]
pub struct CheckpointReceipt {
    pub merkle_root_hex: String,
    pub txid: Option<String>,
    pub anchored_at: DateTime<Utc>,
}

#[async_trait]
pub trait CheckpointAnchor: Send + Sync {
    fn name(&self) -> &'static str;
    async fn anchor(&self, input: CheckpointInput) -> anyhow::Result<CheckpointReceipt>;
}

#[derive(Debug, Default)]
pub struct NoopAnchor;

#[async_trait]
impl CheckpointAnchor for NoopAnchor {
    fn name(&self) -> &'static str {
        "noop"
    }

    async fn anchor(&self, input: CheckpointInput) -> anyhow::Result<CheckpointReceipt> {
        Ok(CheckpointReceipt {
            merkle_root_hex: merkle_root_of(&input),
            txid: None,
            anchored_at: Utc::now(),
        })
    }
}

pub fn merkle_root_of(input: &CheckpointInput) -> String {
    if input.task_ids.is_empty() {
        return "sha256:empty".into();
    }
    let mut layer: Vec<[u8; 32]> = input
        .task_ids
        .iter()
        .map(|s| {
            let mut h = sha2::Sha256::default();
            sha2::digest::Update::update(&mut h, s.as_bytes());
            let d = sha2::digest::FixedOutput::finalize_fixed(h);
            let mut out = [0u8; 32];
            out.copy_from_slice(d.as_slice());
            out
        })
        .collect();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity(layer.len().div_ceil(2));
        for pair in layer.chunks(2) {
            let mut h = sha2::Sha256::default();
            sha2::digest::Update::update(&mut h, &pair[0]);
            if pair.len() == 2 {
                sha2::digest::Update::update(&mut h, &pair[1]);
            } else {
                sha2::digest::Update::update(&mut h, &pair[0]);
            }
            let d = sha2::digest::FixedOutput::finalize_fixed(h);
            let mut out = [0u8; 32];
            out.copy_from_slice(d.as_slice());
            next.push(out);
        }
        layer = next;
    }
    format!("sha256:{}", hex::encode(layer[0]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(ids: Vec<&str>) -> CheckpointInput {
        let count = u64::try_from(ids.len()).unwrap_or(0);
        CheckpointInput {
            workspace_slug: "local".into(),
            period_start: Utc::now(),
            period_end: Utc::now(),
            task_ids: ids.into_iter().map(str::to_string).collect(),
            event_count: count,
        }
    }

    #[test]
    fn empty_input_has_sentinel_root() {
        let r = merkle_root_of(&fixture(vec![]));
        assert_eq!(r, "sha256:empty");
    }

    #[test]
    fn merkle_root_is_deterministic() {
        let a = merkle_root_of(&fixture(vec!["a", "b", "c"]));
        let b = merkle_root_of(&fixture(vec!["a", "b", "c"]));
        assert_eq!(a, b);
    }

    #[test]
    fn order_matters() {
        let a = merkle_root_of(&fixture(vec!["a", "b", "c"]));
        let b = merkle_root_of(&fixture(vec!["c", "b", "a"]));
        assert_ne!(a, b);
    }

    #[tokio::test]
    async fn noop_anchor_returns_receipt() {
        let anchor = NoopAnchor;
        let receipt = anchor.anchor(fixture(vec!["t1"])).await.unwrap();
        assert!(receipt.merkle_root_hex.starts_with("sha256:"));
        assert!(receipt.txid.is_none());
    }
}
