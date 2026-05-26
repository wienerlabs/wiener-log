//! Embedding generator trait + implementations.
//!
//! ADR-0004 picked OpenAI `text-embedding-3-small` at native 1536
//! dimensions; ADR-0005 §"Engine interface" mandates a trait so that
//! tests run without network and Phase 4 can swap in `bge-m3` for
//! compliance-sensitive workspaces.

mod mock;
mod openai;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use mock::MockEmbedder;
pub use openai::{OpenAiEmbedder, OpenAiEmbedderConfig};

/// Errors raised by [`EmbeddingProvider::embed_batch`].
#[derive(Debug, Error)]
pub enum EmbeddingError {
    /// The provider could not be constructed.
    #[error("init: {0}")]
    Init(String),
    /// Network or HTTP error.
    #[error("transport: {0}")]
    Transport(String),
    /// Upstream returned a non-success status.
    #[error("upstream {status}: {body}")]
    Upstream {
        /// HTTP status code.
        status: u16,
        /// Truncated response body.
        body: String,
    },
    /// Decoded response did not match the schema.
    #[error("decode: {0}")]
    Decode(String),
    /// Empty input batch supplied.
    #[error("empty batch")]
    EmptyBatch,
    /// Returned vector dimensionality did not match the provider's
    /// configured value (almost always indicates a model change).
    #[error("dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch {
        /// Configured dimension.
        expected: usize,
        /// Actually-returned dimension.
        actual: usize,
    },
}

/// Token accounting for an embeddings call. Mirrors the OpenAI
/// embeddings response so the cost ledger can use it directly.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmbeddingUsage {
    /// Provider model identifier.
    pub model: String,
    /// Tokens billed to the input.
    pub prompt_tokens: u32,
    /// Total billed tokens (usually equals `prompt_tokens` for
    /// embeddings).
    pub total_tokens: u32,
}

/// Aggregate return type for one batch.
#[derive(Debug, Clone)]
pub struct EmbeddingBatch {
    /// One vector per input text, in the same order.
    pub vectors: Vec<Vec<f32>>,
    /// Token accounting for the call.
    pub usage: EmbeddingUsage,
}

/// Anything that can turn texts into vectors.
#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    /// Provider name for tracing and the cost ledger.
    fn name(&self) -> &'static str;
    /// Vector dimensionality this provider always returns.
    fn dimensions(&self) -> usize;
    /// Embed up to a few hundred short texts at once. Implementations
    /// should reject empty input via [`EmbeddingError::EmptyBatch`].
    async fn embed_batch(&self, texts: &[&str]) -> Result<EmbeddingBatch, EmbeddingError>;
}

/// Maximum inputs per API call recommended by ADR-0004 (#10 acceptance
/// criteria).
pub const MAX_BATCH_INPUTS: usize = 256;
