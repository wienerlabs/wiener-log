# 0005: LLM client

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: engine, synthesis, dependencies

## Context and Problem Statement

Phase 1 brings the synthesis pipeline online. The engine will issue
hundreds of Anthropic API calls per day across triage (Haiku 4.5) and
synthesis (Sonnet 4.6), with prompt caching and cost telemetry on every
call. We need a Rust HTTP client for the Anthropic Messages API.

ADR-0001 flagged this as a known constraint: the Anthropic SDK ecosystem
in Rust is younger than the Python SDK and may force a hand-rolled
client. This ADR records which path we take.

## Decision Drivers

- **Prompt caching control**: cache breakpoints land on specific blocks
  (system prompt, prior user turns). We need to set `cache_control`
  fields exactly where mandate §2.6 cost discipline requires.
- **Streaming**: Phase 1 batched daily synth is non-streaming, but
  Phase 3 agent dispatch streams. Pick a client that supports both.
- **Retries and backoff**: rate-limit responses (429) need exponential
  backoff with jitter; the policy must be ours to tune.
- **Cost telemetry**: every call records input tokens, output tokens,
  cached read tokens, and dollar estimate into `reports/cost/`. The
  client must surface those numbers programmatically.
- **Compile time and binary size**: minimal dependencies; we already
  pull in `reqwest` for ingest-gh.
- **Maturity**: avoid a crate that has not seen a release in six months.

## Considered Options

1. **Hand-rolled `reqwest` client in `wlog-engine`** (`AnthropicClient`).
2. **`anthropic-sdk-rust`** (community SDK, lightly maintained).
3. **`async-anthropic`** (community SDK, async-first, smaller).
4. **`misanthropic`** or another minimal community wrapper.

## Decision Outcome

**Chosen**: Option 1, hand-rolled `reqwest`-backed client in
`wlog-engine`.

### Rationale

The Anthropic Messages API surface we need is small: a single
`POST /v1/messages` endpoint plus optional streaming via SSE. Prompt
caching is a JSON field on input blocks; we do not need a typed wrapper
to set it correctly.

A community SDK forces alignment between our retry policy, our cost
telemetry, and a third party's release cadence. Anthropic's REST API
changes regularly (cache breakpoints, extended thinking blocks, citations).
A hand-rolled client gives us one file to update when that happens.

The `reqwest` dependency is already in the workspace for `wlog-ingest-gh`.
Adding the Anthropic surface costs about 300 lines of code plus a
trait that the rest of the engine programs against:

```rust
#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse, LlmError>;
    async fn stream(&self, req: CompletionRequest) -> Result<CompletionStream, LlmError>;
}
```

Tests use `MockLlmClient` and replay-tape integration tests; production
ships `AnthropicClient`.

### Cost telemetry

`CompletionResponse` carries:

```rust
pub struct CompletionResponse {
    pub content: String,
    pub stop_reason: StopReason,
    pub usage: Usage,
}

pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_creation_input_tokens: u32,
    pub cache_read_input_tokens: u32,
    pub model: String,
}
```

The engine pipes every `Usage` into the cost ledger written to
`reports/cost/YYYY-MM-DD.md` (mandate §2.6).

### Retry policy

- 429 / `overloaded_error`: exponential backoff with jitter
  (`tokio::time::sleep`), max five attempts, max 30s total.
- 5xx: same policy, capped at three attempts.
- Network errors: same as 5xx.
- Anything else: surface to caller without retry.

### Consequences

- **Positive**: zero external SDK dependency; cache and retry policies
  ours to tune; one file to patch when Anthropic ships an API change.
- **Negative**: we own the maintenance burden; future Anthropic-only
  features (batch API, files API) need explicit ports.
- **Risks**: a subtle bug in our SSE parser causes a streaming hang.
  Mitigated by replay-tape tests and a 60-second client-side timeout.

## Validation

Revisit if:

1. Anthropic publishes an official Rust SDK with prompt-caching parity
   and quarterly release cadence. Then we adopt it via ADR-0005-amended
   and delete `AnthropicClient`.
2. Our retry policy fails to keep p99 below 10 seconds for daily synth.
   Add a circuit breaker and revisit.
3. Phase 4 introduces a second LLM provider (Voyage for embeddings is
   already ADR-0004). The `LlmClient` trait already abstracts this;
   ADR-0004's `EmbeddingProvider` is the model.

## Updates

None yet.
