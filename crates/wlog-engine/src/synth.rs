use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tera::{Context, Tera};
use uuid::Uuid;
use wlog_proto::{NodeType, TaskId, TaskStatus, WorkspaceId};

use crate::batch::{Batch, BatchKey};
use crate::llm::{CompletionRequest, LlmClient, Message, Role};

pub const SYNTHESIS_PROMPT_VERSION: &str = "v1";
pub const TRIAGE_PROMPT_VERSION: &str = "v1";

const SYNTH_TEMPLATE: &str = include_str!("../prompts/synthesis_v1.tera");
const TRIAGE_TEMPLATE: &str = include_str!("../prompts/triage_v1.tera");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthEvent {
    pub id: Uuid,
    pub source: String,
    pub kind: String,
    pub occurred_at: DateTime<Utc>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenTaskSummary {
    pub id: TaskId,
    pub title: String,
    pub repo: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TriageCandidate {
    pub id: TaskId,
    pub similarity: f32,
    pub title: String,
    pub repo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNodeProposal {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    pub node_type: NodeType,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub links_to_event_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageDecision {
    #[serde(default)]
    pub link_to: Option<TaskId>,
    #[serde(default)]
    pub confidence: f32,
    #[serde(default)]
    pub synthesize_new: bool,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PromptProvenance {
    pub purpose: &'static str,
    pub version: &'static str,
    pub model: String,
    pub rendered_input_hash: String,
}

pub struct SynthesisEngine<C: LlmClient> {
    tera: Tera,
    client: C,
    model: String,
    workspace_slug: String,
    vocabulary: Vec<String>,
}

impl<C: LlmClient> SynthesisEngine<C> {
    pub fn new(
        client: C,
        workspace_slug: String,
        model: String,
        vocabulary: Vec<String>,
    ) -> anyhow::Result<Self> {
        let mut tera = Tera::default();
        tera.add_raw_template("synthesis_v1.tera", SYNTH_TEMPLATE)?;
        tera.add_raw_template("triage_v1.tera", TRIAGE_TEMPLATE)?;
        Ok(Self {
            tera,
            client,
            model,
            workspace_slug,
            vocabulary,
        })
    }

    pub fn render_synthesis(
        &self,
        batch: &Batch<SynthEvent>,
        open_tasks: &[OpenTaskSummary],
    ) -> anyhow::Result<String> {
        let mut ctx = Context::new();
        ctx.insert("workspace_slug", &self.workspace_slug);
        ctx.insert("window_start", &batch.started_at.to_rfc3339());
        ctx.insert("window_end", &batch.closed_at.to_rfc3339());
        ctx.insert("vocabulary", &self.vocabulary);
        ctx.insert("open_tasks", open_tasks);
        ctx.insert("events", &batch.events);
        Ok(self.tera.render("synthesis_v1.tera", &ctx)?)
    }

    pub fn render_triage(
        &self,
        event: &SynthEvent,
        candidates: &[TriageCandidate],
    ) -> anyhow::Result<String> {
        let mut ctx = Context::new();
        ctx.insert("event", event);
        ctx.insert("candidates", candidates);
        Ok(self.tera.render("triage_v1.tera", &ctx)?)
    }

    pub async fn synthesize(
        &self,
        batch: &Batch<SynthEvent>,
        open_tasks: &[OpenTaskSummary],
    ) -> anyhow::Result<(Vec<TaskNodeProposal>, PromptProvenance)> {
        let prompt = self.render_synthesis(batch, open_tasks)?;
        let provenance = PromptProvenance {
            purpose: "synthesis",
            version: SYNTHESIS_PROMPT_VERSION,
            model: self.model.clone(),
            rendered_input_hash: hash_input(&prompt),
        };
        let req = CompletionRequest {
            model: self.model.clone(),
            system: Some("Synthesize WienerLog task proposals strictly as JSON.".into()),
            cache_system: true,
            messages: vec![Message {
                role: Role::User,
                content: prompt,
                cache: false,
            }],
            max_tokens: 2000,
            temperature: Some(0.0),
        };
        let resp = self.client.complete(req).await?;
        let proposals: Vec<TaskNodeProposal> = serde_json::from_str(resp.content.trim())
            .or_else(|_| extract_json_array(&resp.content))?;
        Ok((proposals, provenance))
    }

    pub async fn triage(
        &self,
        event: &SynthEvent,
        candidates: &[TriageCandidate],
    ) -> anyhow::Result<(TriageDecision, PromptProvenance)> {
        let prompt = self.render_triage(event, candidates)?;
        let provenance = PromptProvenance {
            purpose: "triage",
            version: TRIAGE_PROMPT_VERSION,
            model: self.model.clone(),
            rendered_input_hash: hash_input(&prompt),
        };
        let req = CompletionRequest {
            model: self.model.clone(),
            system: Some("Triage one event against candidates strictly as JSON.".into()),
            cache_system: true,
            messages: vec![Message {
                role: Role::User,
                content: prompt,
                cache: false,
            }],
            max_tokens: 400,
            temperature: Some(0.0),
        };
        let resp = self.client.complete(req).await?;
        let decision: TriageDecision = serde_json::from_str(resp.content.trim())
            .or_else(|_| extract_json_object(&resp.content))?;
        Ok((decision, provenance))
    }
}

fn hash_input(s: &str) -> String {
    let mut h = sha2::Sha256::default();
    sha2::digest::Update::update(&mut h, s.as_bytes());
    let d = sha2::digest::FixedOutput::finalize_fixed(h);
    format!("sha256:{}", hex::encode(d))
}

fn extract_json_array(s: &str) -> anyhow::Result<Vec<TaskNodeProposal>> {
    let start = s
        .find('[')
        .ok_or_else(|| anyhow::anyhow!("no JSON array"))?;
    let end = s
        .rfind(']')
        .ok_or_else(|| anyhow::anyhow!("no JSON array close"))?;
    Ok(serde_json::from_str(&s[start..=end])?)
}

fn extract_json_object(s: &str) -> anyhow::Result<TriageDecision> {
    let start = s
        .find('{')
        .ok_or_else(|| anyhow::anyhow!("no JSON object"))?;
    let end = s
        .rfind('}')
        .ok_or_else(|| anyhow::anyhow!("no JSON object close"))?;
    Ok(serde_json::from_str(&s[start..=end])?)
}

#[allow(dead_code, reason = "consumed by Phase 1 #40 pipeline E2E test")]
pub fn batch_for_workspace(workspace_id: WorkspaceId) -> BatchKey {
    BatchKey {
        workspace_id,
        owner: None,
        repo: None,
    }
}

#[allow(dead_code, reason = "consumed by status reconciliation in Phase 2")]
pub const fn proposal_initial_status() -> TaskStatus {
    TaskStatus::Proposed
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::llm::{CompletionResponse, MockLlmClient, StopReason, Usage};

    fn engine() -> SynthesisEngine<MockLlmClient> {
        let mock = MockLlmClient::default();
        SynthesisEngine::new(
            mock,
            "local".into(),
            "mock-model".into(),
            vec!["Suq".into(), "AIP".into(), "Covenant".into()],
        )
        .unwrap()
    }

    fn fixture_batch() -> Batch<SynthEvent> {
        Batch {
            key: BatchKey {
                workspace_id: WorkspaceId(Uuid::nil()),
                owner: None,
                repo: Some("aperture".into()),
            },
            events: vec![SynthEvent {
                id: Uuid::nil(),
                source: "git".into(),
                kind: "post-commit".into(),
                occurred_at: Utc::now(),
                summary: "fix x402 validator".into(),
            }],
            started_at: Utc::now(),
            closed_at: Utc::now() + chrono::Duration::from_std(Duration::from_secs(60)).unwrap(),
        }
    }

    #[test]
    fn renders_synthesis_template() {
        let e = engine();
        let prompt = e.render_synthesis(&fixture_batch(), &[]).unwrap();
        assert!(prompt.contains("post-commit"));
        assert!(prompt.contains("Suq"));
    }

    #[test]
    fn renders_triage_template() {
        let e = engine();
        let event = SynthEvent {
            id: Uuid::nil(),
            source: "cc".into(),
            kind: "session_message".into(),
            occurred_at: Utc::now(),
            summary: "debug covenant retry".into(),
        };
        let cand = TriageCandidate {
            id: TaskId(Uuid::nil()),
            similarity: 0.92,
            title: "fix covenant retry".into(),
            repo: "covenant".into(),
        };
        let prompt = e.render_triage(&event, &[cand]).unwrap();
        assert!(prompt.contains("0.92"));
        assert!(prompt.contains("covenant"));
    }

    #[tokio::test]
    async fn synthesize_parses_canned_json_array() {
        let mock = MockLlmClient::default();
        mock.enqueue(CompletionResponse {
            content: r#"[{"title":"t1","node_type":"intent","links_to_event_ids":[]}]"#.into(),
            stop_reason: StopReason::EndTurn,
            usage: Usage::default(),
        });
        let e = SynthesisEngine::new(mock, "local".into(), "mock".into(), vec![]).unwrap();
        let (proposals, prov) = e.synthesize(&fixture_batch(), &[]).await.unwrap();
        assert_eq!(proposals.len(), 1);
        assert_eq!(proposals[0].title, "t1");
        assert_eq!(prov.purpose, "synthesis");
    }

    #[tokio::test]
    async fn triage_extracts_object_from_messy_output() {
        let mock = MockLlmClient::default();
        mock.enqueue(CompletionResponse {
            content: "Sure: {\"link_to\":null,\"confidence\":0.4,\"synthesize_new\":false,\"reason\":\"no fit\"}\n".into(),
            stop_reason: StopReason::EndTurn,
            usage: Usage::default(),
        });
        let e = SynthesisEngine::new(mock, "local".into(), "mock".into(), vec![]).unwrap();
        let event = SynthEvent {
            id: Uuid::nil(),
            source: "git".into(),
            kind: "post-commit".into(),
            occurred_at: Utc::now(),
            summary: "x".into(),
        };
        let (d, _) = e.triage(&event, &[]).await.unwrap();
        assert!(!d.synthesize_new);
        assert!(d.confidence < 0.5);
    }
}
