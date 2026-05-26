//! Mock embedder for tests and `wlog daily --dry-run`.

use std::sync::Mutex;

use async_trait::async_trait;

use super::{EmbeddingBatch, EmbeddingError, EmbeddingProvider, EmbeddingUsage};

/// Returns a deterministic vector per input string (a length-prefixed
/// hash spread across `dimensions` floats in `[0, 1)`).
pub struct MockEmbedder {
    dimensions: usize,
    invocations: Mutex<Vec<Vec<String>>>,
}

impl std::fmt::Debug for MockEmbedder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let invs = self.invocations.lock().map_or(0, |v| v.len());
        f.debug_struct("MockEmbedder")
            .field("dimensions", &self.dimensions)
            .field("invocations", &invs)
            .finish_non_exhaustive()
    }
}

impl MockEmbedder {
    /// Build a mock with a given vector dimensionality.
    pub fn new(dimensions: usize) -> Self {
        Self {
            dimensions,
            invocations: Mutex::new(Vec::new()),
        }
    }

    /// Read back which batches the mock has been asked to embed.
    pub fn invocations(&self) -> Vec<Vec<String>> {
        self.invocations.lock().expect("poisoned").clone()
    }
}

impl Default for MockEmbedder {
    fn default() -> Self {
        Self::new(1536)
    }
}

#[async_trait]
impl EmbeddingProvider for MockEmbedder {
    fn name(&self) -> &'static str {
        "mock"
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    async fn embed_batch(&self, texts: &[&str]) -> Result<EmbeddingBatch, EmbeddingError> {
        if texts.is_empty() {
            return Err(EmbeddingError::EmptyBatch);
        }
        self.invocations
            .lock()
            .expect("poisoned")
            .push(texts.iter().map(|s| (*s).to_string()).collect());
        let mut vectors = Vec::with_capacity(texts.len());
        let mut total_tokens: u32 = 0;
        for text in texts {
            let len = u32::try_from(text.len()).unwrap_or(u32::MAX);
            total_tokens = total_tokens.saturating_add(len.div_ceil(4));
            vectors.push(deterministic_vector(text, self.dimensions));
        }
        Ok(EmbeddingBatch {
            vectors,
            usage: EmbeddingUsage {
                model: "mock-model".to_string(),
                prompt_tokens: total_tokens,
                total_tokens,
            },
        })
    }
}

fn deterministic_vector(text: &str, dimensions: usize) -> Vec<f32> {
    // Spread a SHA-256 of the text across `dimensions` floats. Stable
    // across processes so tests can assert on exact vectors.
    let mut hasher = sha2::Sha256::default();
    sha2::digest::Update::update(&mut hasher, text.as_bytes());
    let digest = sha2::digest::FixedOutput::finalize_fixed(hasher);
    let bytes = digest.as_slice();
    let mut out = Vec::with_capacity(dimensions);
    for i in 0..dimensions {
        let byte = bytes[i % bytes.len()];
        // Normalize to [0, 1).
        out.push(f32::from(byte) / 256.0);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn deterministic_vectors_are_reproducible() {
        let m = MockEmbedder::new(8);
        let a = m.embed_batch(&["hello"]).await.unwrap();
        let b = m.embed_batch(&["hello"]).await.unwrap();
        assert_eq!(a.vectors, b.vectors);
        assert_eq!(a.vectors[0].len(), 8);
    }

    #[tokio::test]
    async fn empty_batch_errors() {
        let m = MockEmbedder::new(8);
        assert!(matches!(
            m.embed_batch(&[]).await,
            Err(EmbeddingError::EmptyBatch)
        ));
    }

    #[tokio::test]
    async fn invocations_capture_inputs() {
        let m = MockEmbedder::new(4);
        m.embed_batch(&["a", "b"]).await.unwrap();
        m.embed_batch(&["c"]).await.unwrap();
        let invs = m.invocations();
        assert_eq!(invs.len(), 2);
        assert_eq!(invs[0], vec!["a", "b"]);
        assert_eq!(invs[1], vec!["c"]);
    }
}
