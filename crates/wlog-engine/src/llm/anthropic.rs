//! Hand-rolled Anthropic Messages-API client.
//!
//! Phase 1 ships the shape of the client; the request/response
//! round-trip against the real API is exercised in Phase 1 #32 when
//! synthesis_v1 lands. Tests here cover request construction, retry
//! policy decisions, and JSON decoding.

use std::time::Duration;

use async_trait::async_trait;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use super::{
    CompletionRequest, CompletionResponse, LlmClient, LlmError, Role, StopReason, Usage,
};

const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const DEFAULT_VERSION: &str = "2023-06-01";
const MAX_RETRIES: u32 = 5;
const BASE_BACKOFF: Duration = Duration::from_millis(500);

/// Construction parameters for [`AnthropicClient`].
#[derive(Debug, Clone)]
pub struct AnthropicConfig {
    /// API key (do not log).
    pub api_key: String,
    /// Override the API base URL (e.g. for replay tape).
    pub base_url: Option<String>,
    /// Anthropic API version header. Defaults to `2023-06-01`.
    pub version: Option<String>,
    /// Per-call timeout; defaults to [`super::DEFAULT_TIMEOUT`].
    pub timeout: Option<Duration>,
}

/// `reqwest`-backed client for the Anthropic Messages API.
pub struct AnthropicClient {
    http: Client,
    config: AnthropicConfig,
}

impl std::fmt::Debug for AnthropicClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // `api_key` deliberately omitted.
        f.debug_struct("AnthropicClient")
            .field("base_url", &self.config.base_url)
            .field("version", &self.config.version)
            .field("timeout", &self.config.timeout)
            .finish_non_exhaustive()
    }
}

impl AnthropicClient {
    /// Construct a new client. Fails only if the underlying `reqwest`
    /// builder rejects the timeout / TLS config.
    pub fn new(config: AnthropicConfig) -> Result<Self, LlmError> {
        let timeout = config.timeout.unwrap_or(super::DEFAULT_TIMEOUT);
        let http = Client::builder()
            .timeout(timeout)
            .user_agent("wlog-engine/0.0.1 (anthropic)")
            .build()
            .map_err(|e| LlmError::Init(e.to_string()))?;
        Ok(Self { http, config })
    }

    fn base_url(&self) -> &str {
        self.config.base_url.as_deref().unwrap_or(DEFAULT_BASE_URL)
    }

    fn version(&self) -> &str {
        self.config.version.as_deref().unwrap_or(DEFAULT_VERSION)
    }
}

#[async_trait]
impl LlmClient for AnthropicClient {
    fn name(&self) -> &'static str {
        "anthropic"
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LlmError> {
        let url = format!("{}/v1/messages", self.base_url());
        let body = build_request_body(&request);

        let mut attempt: u32 = 0;
        loop {
            let resp = self
                .http
                .post(&url)
                .header("x-api-key", &self.config.api_key)
                .header("anthropic-version", self.version())
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| LlmError::Transport(e.to_string()))?;

            let status = resp.status();
            if status.is_success() {
                let parsed: AnthropicResponse = resp
                    .json()
                    .await
                    .map_err(|e| LlmError::Decode(e.to_string()))?;
                return Ok(parsed.into_response());
            }

            attempt += 1;
            let retryable = is_retryable(status) && attempt < MAX_RETRIES;
            let body_text = resp
                .text()
                .await
                .unwrap_or_else(|_| "(no body)".to_string());
            let trimmed = truncate_body(&body_text);
            if !retryable {
                return Err(LlmError::Upstream {
                    status: status.as_u16(),
                    body: trimmed,
                });
            }
            let backoff = backoff_for_attempt(attempt);
            // backoff is capped at ~5s, so the u128 returned by
            // as_millis always fits in a u64; clamp to be defensive.
            let wait_ms = u64::try_from(backoff.as_millis()).unwrap_or(u64::MAX);
            tracing::warn!(
                attempt,
                status = status.as_u16(),
                wait_ms,
                "retrying after upstream error"
            );
            tokio::time::sleep(backoff).await;
        }
    }
}

fn is_retryable(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

fn backoff_for_attempt(attempt: u32) -> Duration {
    // Exponential with a fixed 5s ceiling and millisecond-grained jitter.
    let exp = u32::min(attempt.saturating_sub(1), 4);
    let base = BASE_BACKOFF.saturating_mul(1 << exp);
    let capped = base.min(Duration::from_secs(5));
    let jitter_ms = u64::from(attempt) * 31 % 250;
    capped + Duration::from_millis(jitter_ms)
}

fn truncate_body(body: &str) -> String {
    const MAX: usize = 2048;
    if body.len() <= MAX {
        body.to_string()
    } else {
        let head: String = body.chars().take(MAX).collect();
        format!("{head}... <truncated>")
    }
}

fn build_request_body(request: &CompletionRequest) -> AnthropicRequest<'_> {
    let mut messages = Vec::with_capacity(request.messages.len());
    for msg in &request.messages {
        let cache = if msg.cache {
            Some(CacheControl { ty: "ephemeral" })
        } else {
            None
        };
        messages.push(AnthropicMessage {
            role: msg.role,
            content: vec![ContentBlock::Text {
                text: msg.content.as_str(),
                cache_control: cache,
            }],
        });
    }
    let system = request.system.as_deref().map(|s| {
        vec![ContentBlock::Text {
            text: s,
            cache_control: request
                .cache_system
                .then_some(CacheControl { ty: "ephemeral" }),
        }]
    });
    AnthropicRequest {
        model: request.model.as_str(),
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        system,
        messages,
    }
}

#[derive(Debug, Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<Vec<ContentBlock<'a>>>,
    messages: Vec<AnthropicMessage<'a>>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage<'a> {
    role: Role,
    content: Vec<ContentBlock<'a>>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentBlock<'a> {
    Text {
        text: &'a str,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<CacheControl>,
    },
}

#[derive(Debug, Serialize, Clone, Copy)]
struct CacheControl {
    #[serde(rename = "type")]
    ty: &'static str,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicResponseBlock>,
    stop_reason: Option<String>,
    model: String,
    usage: AnthropicUsage,
}

impl AnthropicResponse {
    fn into_response(self) -> CompletionResponse {
        let content = self
            .content
            .into_iter()
            .map(|AnthropicResponseBlock::Text { text }| text)
            .collect::<Vec<_>>()
            .join("\n");
        let stop_reason = match self.stop_reason.as_deref() {
            Some("max_tokens") => StopReason::MaxTokens,
            Some("stop_sequence") => StopReason::StopSequence,
            Some("tool_use") => StopReason::ToolUse,
            _ => StopReason::EndTurn,
        };
        let usage = Usage {
            model: self.model,
            input_tokens: self.usage.input_tokens,
            output_tokens: self.usage.output_tokens,
            cache_creation_input_tokens: self.usage.cache_creation_input_tokens.unwrap_or(0),
            cache_read_input_tokens: self.usage.cache_read_input_tokens.unwrap_or(0),
        };
        CompletionResponse {
            content,
            stop_reason,
            usage,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AnthropicResponseBlock {
    Text { text: String },
}

#[allow(clippy::struct_field_names, reason = "matches the upstream JSON schema")]
#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
    cache_creation_input_tokens: Option<u32>,
    cache_read_input_tokens: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::Message;

    fn fixture_request() -> CompletionRequest {
        CompletionRequest {
            model: "claude-haiku-4-5".to_string(),
            system: Some("You synthesize WienerLog task proposals.".to_string()),
            cache_system: true,
            messages: vec![Message {
                role: Role::User,
                content: "Summarize the day.".to_string(),
                cache: false,
            }],
            max_tokens: 200,
            temperature: Some(0.0),
        }
    }

    #[test]
    fn request_body_marks_cache_breakpoints() {
        let req = fixture_request();
        let body = build_request_body(&req);
        let json = serde_json::to_value(&body).unwrap();
        let system = json.get("system").unwrap().as_array().unwrap();
        let cache = system[0].get("cache_control").unwrap();
        assert_eq!(cache.get("type").unwrap(), "ephemeral");
    }

    #[test]
    fn request_body_omits_cache_when_off() {
        let mut req = fixture_request();
        req.cache_system = false;
        let body = build_request_body(&req);
        let json = serde_json::to_value(&body).unwrap();
        assert!(
            json.get("system").unwrap()[0]
                .get("cache_control")
                .is_none()
        );
    }

    #[test]
    fn response_parses_with_cache_tokens() {
        let raw = r#"{
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": "claude-haiku-4-5-20260301",
            "content": [{"type":"text","text":"Hello"}],
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 10,
                "output_tokens": 5,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 100
            }
        }"#;
        let parsed: AnthropicResponse = serde_json::from_str(raw).unwrap();
        let response = parsed.into_response();
        assert_eq!(response.content, "Hello");
        assert_eq!(response.stop_reason, StopReason::EndTurn);
        assert_eq!(response.usage.input_tokens, 10);
        assert_eq!(response.usage.cache_read_input_tokens, 100);
        assert!(response.usage.estimate_usd() > 0.0);
    }

    #[test]
    fn backoff_grows_then_caps() {
        let b1 = backoff_for_attempt(1);
        let b3 = backoff_for_attempt(3);
        let b6 = backoff_for_attempt(6);
        assert!(b1 < b3);
        assert!(b6 <= Duration::from_secs(6));
    }

    #[test]
    fn truncate_body_caps_long_payloads() {
        let big = "x".repeat(5000);
        let cut = truncate_body(&big);
        assert!(cut.len() < 5000);
        assert!(cut.ends_with("<truncated>"));
    }
}
