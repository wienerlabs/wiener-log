# 0001 — Rust as primary language

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: language, tooling

## Context and Problem Statement

WienerLog spans four layers: ingestion daemons that watch git and filesystem
events, a storage layer over Postgres, a synthesis engine that orchestrates
LLM calls, and a CLI surface. The same codebase must run as long-lived
daemons under systemd, as a short-lived CLI binary on developer machines,
and eventually as a web surface. Picking the language wrong forces a
polyglot stack from day one, which we want to defer until justified.

## Decision Drivers

- Single binary distribution on Linux and macOS, with cross-compile.
- Strong type system so that the protocol contracts in `wlog-proto` cannot
  drift across crate boundaries.
- Memory safety without a GC: the daemons run for weeks; predictable
  resource usage matters more than raw throughput.
- Mature async ecosystem (Tokio).
- Good Postgres tooling with compile-time query verification (`sqlx`).
- Good ergonomics for spawning child processes (subagent dispatch in
  Phase 3).
- The author's productive baseline. Burnout from fighting the language is a
  real risk in a multi-month solo build.

## Considered Options

1. **Rust** — single binaries, strong types, no GC, async via Tokio.
2. **Go** — fast iteration, single binaries, weaker type system, easier
   concurrency story.
3. **TypeScript on Bun or Node** — author's primary daily language for web
   work, large ecosystem, but daemon ergonomics are weaker.
4. **Python** — fastest prototyping; rejected for daemon work due to GIL
   and packaging friction.

## Decision Outcome

**Chosen**: Rust (edition 2024, MSRV 1.95).

### Rationale

Three layers benefit from Rust's properties:

- **Ingestion**: the daemons watch filesystem and network events
  continuously. We want a predictable resource footprint and no GC pauses
  during high-volume webhook bursts.
- **Storage**: `sqlx`'s compile-time query checking catches schema drift at
  build time. This is the single most useful property of any DB layer we
  could pick.
- **Protocol**: `wlog-proto` is shared across every binary. Rust's type
  system makes wire-format drift a compile error, not a runtime mystery.

Go was the closest alternative. We rejected it because the protocol crate
would lose its compile-time guarantees: Go's structural typing and `any`
escape hatches make it too easy for an ingestion adapter to drift from the
storage layer. The author is also more productive in Rust than in Go for
multi-crate workspaces.

TypeScript was rejected for daemon use; we may revisit it for the Phase 4
web surface (see ADR-0010 placeholder).

Python was rejected outright. Synthesis worker latency budgets are tight,
and we want to ship native binaries.

### Consequences

- **Positive**: single binary per role, compile-time protocol guarantees,
  predictable resource use, strong test culture from cargo built-ins.
- **Negative**: slower iteration than TS/Python; longer compile times;
  fewer LLM SDK options than Python.
- **Risks**: the LLM client choice (ADR-0003) is constrained; we may end up
  hand-rolling a Tokio + reqwest client rather than using a maintained SDK.
  This is acceptable but trackable.

## Validation

Revisit if:

1. Compile times on developer machines exceed three minutes for incremental
   builds. We can mitigate with `sccache`, but a sustained breach indicates
   the workspace has grown beyond what Cargo handles well.
2. The web surface (Phase 4) demonstrates that the full-Rust path (Leptos)
   produces unacceptable ergonomics. ADR-0010 will decide.
3. The Anthropic SDK ecosystem matures around Rust to the point where the
   tradeoff vs Python flips. (Currently the Python SDK leads by ~6 months
   on new features.)

## Updates

None yet.
