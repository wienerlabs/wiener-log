//! LLM client surface for the synthesis, triage, and dispatch engines.
//!
//! Decisions live in [ADR-0005](../../../../docs/adr/0005-llm-client.md).
//!
//! Two implementations ship in Phase 1:
//!
//! - [`AnthropicClient`]: hand-rolled `reqwest` client against the
//!   Messages API with prompt caching and retry policy.
//! - [`MockLlmClient`]: configurable canned responses for tests.

mod anthropic;
mod mock;

use std::time::Duration;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use anthropic::{AnthropicClient, AnthropicConfig};
pub use mock::MockLlmClient;

/// One role in a Messages-API conversation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Human turn.
    User,
    /// Assistant turn (model output).
    Assistant,
}

/// A single turn in the conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Role of the speaker.
    pub role: Role,
    /// Content as a single text block. Multi-block content (vision,
    /// tool results) lands in Phase 3 when dispatcher needs it.
    pub content: String,
    /// Whether to mark this turn as a prompt-cache breakpoint. See
    /// ADR-0005 §"Cost telemetry".
    #[serde(default)]
    pub cache: bool,
}

/// Why the model stopped generating.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// Natural end of turn.
    EndTurn,
    /// Max tokens reached.
    MaxTokens,
    /// Sequence-stop matched.
    StopSequence,
    /// Tool-use stop (Phase 3).
    ToolUse,
}

/// Cost and model accounting for a single completion. Flows into the
/// cost ledger defined in mandate §2.6 and Phase 1 issue #39.
#[allow(
    clippy::struct_field_names,
    reason = "all fields are token counters by design"
)]
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Usage {
    /// Model identifier as returned by the API.
    pub model: String,
    /// Tokens billed as input.
    pub input_tokens: u32,
    /// Tokens billed as output.
    pub output_tokens: u32,
    /// Tokens written into the prompt cache.
    pub cache_creation_input_tokens: u32,
    /// Tokens served from a cache hit.
    pub cache_read_input_tokens: u32,
}

impl Usage {
    /// Naive USD estimate at the per-million rates in
    /// `pricing::estimate_usd`. The engine's cost ledger replaces this
    /// with the authoritative pricing table in Phase 1 #39.
    pub fn estimate_usd(&self) -> f64 {
        pricing::estimate_usd(self)
    }
}

/// A request to the model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    /// Anthropic model identifier (e.g. `claude-sonnet-4-6-20260301`).
    pub model: String,
    /// Optional system prompt; cached when `cache_system` is true.
    pub system: Option<String>,
    /// Whether to mark the system prompt as a cache breakpoint.
    #[serde(default)]
    pub cache_system: bool,
    /// Conversation turns, oldest first.
    pub messages: Vec<Message>,
    /// Token cap on the model's response.
    pub max_tokens: u32,
    /// Sampling temperature. None defers to model default.
    pub temperature: Option<f32>,
}

/// A completed response from the model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    /// Text the model produced.
    pub content: String,
    /// Reason generation stopped.
    pub stop_reason: StopReason,
    /// Token accounting.
    pub usage: Usage,
}

/// Errors surfaced by [`LlmClient`].
#[derive(Debug, Error)]
pub enum LlmError {
    /// The configured client could not be constructed.
    #[error("client init: {0}")]
    Init(String),
    /// Network or HTTP error talking to the upstream.
    #[error("transport: {0}")]
    Transport(String),
    /// Upstream returned a non-success status after retries.
    #[error("upstream error: {status}: {body}")]
    Upstream {
        /// HTTP status code.
        status: u16,
        /// Response body, truncated to 2 KB to keep logs readable.
        body: String,
    },
    /// Daily or rolling cost ceiling exceeded (see Phase 1 #39).
    #[error("cost ceiling exceeded")]
    CostCeilingExceeded,
    /// Response did not match the expected schema.
    #[error("decode: {0}")]
    Decode(String),
}

/// Anything that can complete a [`CompletionRequest`].
#[async_trait]
pub trait LlmClient: Send + Sync {
    /// Human-readable name for tracing and the cost ledger.
    fn name(&self) -> &'static str;

    /// Synchronous (non-streaming) completion.
    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LlmError>;
}

/// Default per-call timeout for non-streaming completions. Streaming
/// will need a longer ceiling when Phase 3 wires it.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_mins(1);

/// Naive token pricing used until Phase 1 #39 lands the authoritative
/// ledger. Numbers track Anthropic's published list price for
/// Sonnet 4.6 / Haiku 4.5 as of 2026-05.
pub mod pricing {
    use super::Usage;

    /// Per-million-token list prices in USD.
    #[derive(Debug, Clone, Copy)]
    pub struct Price {
        /// Standard input tokens.
        pub input: f64,
        /// Standard output tokens.
        pub output: f64,
        /// Cache-creation input tokens (one-time premium).
        pub cache_creation: f64,
        /// Cache-read input tokens (steeply discounted).
        pub cache_read: f64,
    }

    /// Lookup table for the models WienerLog uses.
    pub fn price_for(model: &str) -> Option<Price> {
        match model {
            m if m.contains("opus-4-7") => Some(Price {
                input: 15.00,
                output: 75.00,
                cache_creation: 18.75,
                cache_read: 1.50,
            }),
            m if m.contains("sonnet-4-6") || m.contains("sonnet-4.6") => Some(Price {
                input: 3.00,
                output: 15.00,
                cache_creation: 3.75,
                cache_read: 0.30,
            }),
            m if m.contains("haiku-4-5") || m.contains("haiku-4.5") => Some(Price {
                input: 1.00,
                output: 5.00,
                cache_creation: 1.25,
                cache_read: 0.10,
            }),
            _ => None,
        }
    }

    /// USD estimate for a single completion, returning 0.0 for unknown
    /// models. The cost ledger logs a warning when this fallback fires.
    pub fn estimate_usd(usage: &Usage) -> f64 {
        let Some(price) = price_for(&usage.model) else {
            return 0.0;
        };
        let scale = 1_000_000.0;
        f64::from(usage.input_tokens) * price.input / scale
            + f64::from(usage.output_tokens) * price.output / scale
            + f64::from(usage.cache_creation_input_tokens) * price.cache_creation / scale
            + f64::from(usage.cache_read_input_tokens) * price.cache_read / scale
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pricing_returns_zero_for_unknown_model() {
        let usage = Usage {
            model: "made-up-model".to_string(),
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        };
        assert!((usage.estimate_usd() - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn pricing_for_haiku_matches_table() {
        let usage = Usage {
            model: "claude-haiku-4-5-20260301".to_string(),
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        };
        // 1.00 + 5.00
        assert!((usage.estimate_usd() - 6.00).abs() < 1e-9);
    }

    #[test]
    fn pricing_counts_cache_separately() {
        let usage = Usage {
            model: "claude-sonnet-4-6-20260301".to_string(),
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 1_000_000,
            cache_read_input_tokens: 2_000_000,
        };
        // 3.75 + 2 * 0.30
        assert!((usage.estimate_usd() - 4.35).abs() < 1e-9);
    }
}
