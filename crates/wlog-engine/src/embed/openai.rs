//! OpenAI `/v1/embeddings` client.

use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::{EmbeddingBatch, EmbeddingError, EmbeddingProvider, EmbeddingUsage, MAX_BATCH_INPUTS};

const DEFAULT_BASE_URL: &str = "https://api.openai.com";
const DEFAULT_MODEL: &str = "text-embedding-3-small";
const DEFAULT_DIMENSIONS: usize = 1536;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Construction parameters for [`OpenAiEmbedder`].
#[derive(Debug, Clone)]
pub struct OpenAiEmbedderConfig {
    /// API key (do not log).
    pub api_key: String,
    /// Override the API base URL (e.g. for replay tape).
    pub base_url: Option<String>,
    /// Model identifier; defaults to ADR-0004's choice.
    pub model: Option<String>,
    /// Override the dimensions. Must match the model.
    pub dimensions: Option<usize>,
    /// Per-call timeout.
    pub timeout: Option<Duration>,
}

impl OpenAiEmbedderConfig {
    /// Build a config from an API key, taking ADR-0004 defaults for
    /// every other knob.
    pub fn from_api_key(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: None,
            model: None,
            dimensions: None,
            timeout: None,
        }
    }
}

/// reqwest-backed OpenAI embeddings client.
pub struct OpenAiEmbedder {
    http: Client,
    config: OpenAiEmbedderConfig,
}

impl std::fmt::Debug for OpenAiEmbedder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // `api_key` deliberately omitted.
        f.debug_struct("OpenAiEmbedder")
            .field("base_url", &self.config.base_url)
            .field("model", &self.config.model)
            .field("dimensions", &self.config.dimensions)
            .finish_non_exhaustive()
    }
}

impl OpenAiEmbedder {
    /// Construct an embedder. Fails only on reqwest builder errors.
    pub fn new(config: OpenAiEmbedderConfig) -> Result<Self, EmbeddingError> {
        let http = Client::builder()
            .timeout(config.timeout.unwrap_or(DEFAULT_TIMEOUT))
            .user_agent("wlog-engine/0.0.1 (openai-embed)")
            .build()
            .map_err(|e| EmbeddingError::Init(e.to_string()))?;
        Ok(Self { http, config })
    }

    fn base_url(&self) -> &str {
        self.config.base_url.as_deref().unwrap_or(DEFAULT_BASE_URL)
    }

    fn model(&self) -> &str {
        self.config.model.as_deref().unwrap_or(DEFAULT_MODEL)
    }

    fn dim(&self) -> usize {
        self.config.dimensions.unwrap_or(DEFAULT_DIMENSIONS)
    }
}

#[async_trait]
impl EmbeddingProvider for OpenAiEmbedder {
    fn name(&self) -> &'static str {
        "openai"
    }

    fn dimensions(&self) -> usize {
        self.dim()
    }

    async fn embed_batch(&self, texts: &[&str]) -> Result<EmbeddingBatch, EmbeddingError> {
        if texts.is_empty() {
            return Err(EmbeddingError::EmptyBatch);
        }
        if texts.len() > MAX_BATCH_INPUTS {
            return Err(EmbeddingError::Init(format!(
                "batch size {} exceeds MAX_BATCH_INPUTS {}",
                texts.len(),
                MAX_BATCH_INPUTS
            )));
        }
        let body = Request {
            model: self.model(),
            input: texts,
            dimensions: Some(self.dim()),
        };
        let resp = self
            .http
            .post(format!("{}/v1/embeddings", self.base_url()))
            .bearer_auth(&self.config.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| EmbeddingError::Transport(e.to_string()))?;
        let status = resp.status();
        if !status.is_success() {
            let body_text = resp
                .text()
                .await
                .unwrap_or_else(|_| "(no body)".to_string());
            return Err(EmbeddingError::Upstream {
                status: status.as_u16(),
                body: truncate(&body_text, 2048),
            });
        }
        let parsed: Response = resp
            .json()
            .await
            .map_err(|e| EmbeddingError::Decode(e.to_string()))?;
        if parsed.data.len() != texts.len() {
            return Err(EmbeddingError::Decode(format!(
                "expected {} embeddings, got {}",
                texts.len(),
                parsed.data.len()
            )));
        }
        let mut by_index: Vec<(usize, Vec<f32>)> = parsed
            .data
            .into_iter()
            .map(|d| (d.index, d.embedding))
            .collect();
        by_index.sort_by_key(|(idx, _)| *idx);
        let vectors: Vec<Vec<f32>> = by_index.into_iter().map(|(_, v)| v).collect();
        if let Some(first) = vectors.first()
            && first.len() != self.dim()
        {
            return Err(EmbeddingError::DimensionMismatch {
                expected: self.dim(),
                actual: first.len(),
            });
        }
        Ok(EmbeddingBatch {
            vectors,
            usage: EmbeddingUsage {
                model: parsed.model,
                prompt_tokens: parsed.usage.prompt_tokens,
                total_tokens: parsed.usage.total_tokens,
            },
        })
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max).collect();
        out.push_str("... <truncated>");
        out
    }
}

#[derive(Serialize)]
struct Request<'a> {
    model: &'a str,
    input: &'a [&'a str],
    #[serde(skip_serializing_if = "Option::is_none")]
    dimensions: Option<usize>,
}

#[derive(Deserialize)]
struct Response {
    data: Vec<Datum>,
    model: String,
    usage: Usage,
}

#[derive(Deserialize)]
struct Datum {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Deserialize)]
struct Usage {
    prompt_tokens: u32,
    total_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dimensions_falls_back_to_default() {
        let embedder = OpenAiEmbedder::new(OpenAiEmbedderConfig::from_api_key("x")).unwrap();
        assert_eq!(embedder.dimensions(), 1536);
        assert_eq!(embedder.model(), "text-embedding-3-small");
    }

    #[test]
    fn custom_model_and_dimensions_propagate() {
        let embedder = OpenAiEmbedder::new(OpenAiEmbedderConfig {
            api_key: "x".to_string(),
            base_url: None,
            model: Some("text-embedding-3-large".to_string()),
            dimensions: Some(3072),
            timeout: None,
        })
        .unwrap();
        assert_eq!(embedder.dimensions(), 3072);
        assert_eq!(embedder.model(), "text-embedding-3-large");
    }

    #[test]
    fn request_body_skips_dimensions_when_none() {
        let body = Request {
            model: "m",
            input: &["a"],
            dimensions: None,
        };
        let json = serde_json::to_value(&body).unwrap();
        assert!(json.get("dimensions").is_none());
    }

    #[test]
    fn request_body_includes_dimensions_when_set() {
        let body = Request {
            model: "m",
            input: &["a"],
            dimensions: Some(1536),
        };
        let json = serde_json::to_value(&body).unwrap();
        assert_eq!(json["dimensions"], 1536);
    }
}
