//! Smoke-test the synthesis pipeline against a one-shot mocked LLM.
//!
//! ```
//! cargo run -p wlog-engine --example synth_one_batch
//! ```
//!
//! Useful for verifying end-to-end Tera rendering + JSON decode without
//! standing up the daemon, NATS, or Postgres. For a real Anthropic
//! call replace `MockLlmClient` with `AnthropicClient::new(...)` and
//! export `ANTHROPIC_API_KEY`.

use chrono::Utc;
use uuid::Uuid;
use wlog_engine::batch::{Batch, BatchKey};
use wlog_engine::llm::{CompletionResponse, MockLlmClient, StopReason, Usage};
use wlog_engine::synth::{OpenTaskSummary, SynthEvent, SynthesisEngine};
use wlog_proto::{TaskId, WorkspaceId};

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let workspace_id = WorkspaceId(Uuid::new_v4());

    let batch = Batch {
        key: BatchKey {
            workspace_id,
            owner: None,
            repo: Some("wienerlabs/wienerlog".into()),
        },
        events: vec![
            SynthEvent {
                id: Uuid::new_v4(),
                source: "git".into(),
                kind: "post-commit".into(),
                occurred_at: Utc::now(),
                summary: "feat(auth): rate-limit /api/login (3 commits)".into(),
            },
            SynthEvent {
                id: Uuid::new_v4(),
                source: "cc".into(),
                kind: "session-end".into(),
                occurred_at: Utc::now(),
                summary: "claude session 24m, 5 tool uses, file edits in src/auth/".into(),
            },
            SynthEvent {
                id: Uuid::new_v4(),
                source: "gh".into(),
                kind: "pr.merged".into(),
                occurred_at: Utc::now(),
                summary: "PR #142 merged: feat(auth): rate-limit /api/login".into(),
            },
        ],
        started_at: Utc::now(),
        closed_at: Utc::now(),
    };

    let open_tasks = vec![OpenTaskSummary {
        id: TaskId(Uuid::new_v4()),
        title: "Investigate brute-force attempts on /api/login".into(),
        repo: "wienerlabs/wienerlog".into(),
    }];

    // Canned synthesis response: one proposed task.
    let canned = r#"{
      "proposals": [
        {
          "title": "Rate-limit /api/login",
          "body": "Adopted token bucket; merged in #142 after Claude-assisted edits.",
          "node_type": "execution",
          "repo": "wienerlabs/wienerlog",
          "links_to_event_ids": []
        }
      ]
    }"#;

    let mock = MockLlmClient::new(CompletionResponse {
        content: canned.to_string(),
        stop_reason: StopReason::EndTurn,
        usage: Usage {
            model: "claude-sonnet-4-6-20260301".into(),
            input_tokens: 412,
            output_tokens: 88,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        },
    });

    let engine = SynthesisEngine::new(
        mock,
        "demo".into(),
        "claude-sonnet-4-6-20260301".into(),
        vec![
            "feat".into(),
            "fix".into(),
            "refactor".into(),
            "perf".into(),
            "test".into(),
            "docs".into(),
            "chore".into(),
        ],
    )?;

    let (proposals, provenance) = engine.synthesize(&batch, &open_tasks).await?;

    println!("== synthesis_v1 ==");
    println!("model:     {}", provenance.model);
    println!("version:   {}", provenance.version);
    println!("prompt #:  {}", provenance.rendered_input_hash);
    println!();
    println!("== proposals ==");
    for p in &proposals {
        println!("- {} ({:?})", p.title, p.node_type);
        if let Some(body) = &p.body {
            println!("  {body}");
        }
    }
    println!();

    let canned_usage = Usage {
        model: "claude-sonnet-4-6-20260301".into(),
        input_tokens: 412,
        output_tokens: 88,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
    };
    println!("USD est:   ${:.4}", canned_usage.estimate_usd());
    Ok(())
}
