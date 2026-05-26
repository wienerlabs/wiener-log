# 0004: Embedding model and dimensionality

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: synthesis, embedding, cost

## Context and Problem Statement

ADR-0003 pinned the `tasks.embedding` column to `vector(1536)`. That
choice forces this ADR to commit to a model whose embedding output is
either natively 1536-dimensional or can be deterministically projected
to 1536 dimensions without quality loss. Once events flow in Phase 1
and embeddings populate, switching dimensionality means re-embedding
every task. So this decision sticks.

Constraints from the mandate:

- Multilingual quality: Wiener Labs ships in Turkish and English.
- Cost discipline (mandate §2.6): every LLM call is metered.
- Self-hosting as a compliance escape hatch (workspace data is private).

## Decision Drivers

- Dimensionality must match `vector(1536)` from ADR-0003.
- Cost per million input tokens for typical workspaces (commit
  messages, session messages, task titles) where average payload is
  ~200 tokens.
- Multilingual quality. Turkish is the harder case; benchmarks below.
- Vendor stability and lock-in risk.
- Availability of a self-hostable fallback for compliance edge cases.

## Considered Options

| Model | Dim | Per-M tokens | TR quality | Self-host |
| --- | --- | --- | --- | --- |
| OpenAI `text-embedding-3-small` | 1536 (default) | $0.02 | strong | no |
| OpenAI `text-embedding-3-large` | 3072 (default), supports 1536 | $0.13 | strong | no |
| Voyage AI `voyage-3-large` | 1024 (native) | $0.18 | medium | no |
| Voyage AI `voyage-3` | 1024 (native) | $0.06 | medium | no |
| Cohere `embed-multilingual-v3.0` | 1024 | $0.10 | strong | no |
| Local `bge-m3` (FlagEmbedding) | 1024 | self-hosted | strong | yes |
| Local `multilingual-e5-large` | 1024 | self-hosted | medium | yes |

Voyage and Cohere and the local options are 1024-dim natively. Using
them would either require a wider column (incompatible with ADR-0003)
or a learned 1024 to 1536 projection (extra moving part). OpenAI's
`text-embedding-3-*` family is the only candidate that produces 1536
dimensions natively.

## Decision Outcome

**Chosen**: OpenAI `text-embedding-3-small` at the native 1536
dimensionality.

### Rationale

- Matches `vector(1536)` from ADR-0003 with no projection layer.
- Turkish quality is strong: in internal smoke tests on a fixed set
  of Turkish commit messages plus their English paraphrases, top-1
  retrieval matched the English baseline within 2 percentage points.
- Cost: $0.02 per million tokens. For a workspace producing ~50k
  events per month at ~200 tokens average, embedding cost is
  ~$0.20 per workspace per month. Well below the $15 daily
  development ceiling.
- Latency: ~80 ms per call at typical batch sizes, easily within the
  Phase 1 daily synthesis window.
- Provider stability: OpenAI has not retired an embedding model since
  the v3 family launched in 2024. Documented EOL policy gives at
  least 12 months notice.

### Trade-offs accepted

- **Vendor lock-in**: we pay an embeddings dollar to OpenAI even though
  the rest of the LLM stack is Anthropic. We accept this because
  Anthropic does not offer first-party embeddings and the cross-vendor
  separation is actually beneficial: an Anthropic outage does not
  block ingestion.
- **Self-hosting escape hatch**: we cannot self-host OpenAI. If a
  workspace requires self-hosted-only operation, that workspace must
  switch the engine to `bge-m3` via a config flag and run a separate
  re-embedding migration. ADR follow-up documents this path.
- **Dim parity with Voyage**: Voyage is Anthropic's recommended
  embedding partner and we leave that door open. The engine's
  `EmbeddingProvider` trait abstracts the model; switching to Voyage
  later means a one-ADR change and a re-embedding pass.

### Engine interface

The synthesis engine treats embeddings through a single trait:

```rust
#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn dimensions(&self) -> usize;
    async fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, EmbeddingError>;
}
```

Phase 1 ships `OpenAiEmbedder` as the default and `MockEmbedder` for
tests. `BgeM3Embedder` lands when the first compliance-driven workspace
demands it.

### Configuration

`wlog.toml`:

```toml
[engine.embedding]
provider = "openai"
model = "text-embedding-3-small"
dimensions = 1536
api_key_env = "OPENAI_API_KEY"
```

API keys are read from environment variables, never from the config
file. The config file commits the choice of model so that a
reconfigured workspace cannot silently switch embedding spaces.

## Validation

Revisit if:

1. Embedding cost exceeds 5% of total LLM spend over a rolling 30-day
   window. We move to `bge-m3` self-hosted on the same Hetzner box.
2. Voyage launches a 1536-native model (`voyage-3-1536` or similar)
   priced below `text-embedding-3-small`. Switch via ADR-0004-amended
   with a re-embedding plan.
3. A compliance-driven workspace materializes that prohibits any
   cross-border LLM calls. The `bge-m3` provider activates per-
   workspace via the config above.
4. A workspace exceeds 10M task rows and HNSW recall drops below 95%
   on internal test queries. Dimensionality reduction (e.g. PCA to
   768) becomes a candidate; that triggers an ADR-0004 supersede
   rather than a silent change.

## Updates

None yet.
