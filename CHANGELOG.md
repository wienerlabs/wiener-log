# Changelog

All notable changes to WienerLog are documented in this file. The format is
based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it reaches v1.0.0.

## [Unreleased]

### Added since 0.1.0

- **CLI banner** (`wlog banner`): ASCII Wiener Labs logo. TTY-aware, NO_COLOR
  + WLOG_COLOR honored, truecolor #fff4dd cream + #0e0e0e foreground.
- **CLI banner on startup** for `wlog init` and `wlog daemon run`.
- **Operational infrastructure**:
  - `infra/monitor/` Grafana 11 + Loki 3 + Promtail + Prometheus 2.55 stack
    with pre-provisioned `WienerLog Overview` dashboard.
  - `infra/systemd/` hardened `wlog-daemon.service` + nightly
    `wlog-backup.timer` + 5-min `wlog-healthcheck.timer`.
  - `infra/macos/` developer launchd plist.
  - `scripts/{backup,restore}-postgres.sh` + `scripts/healthcheck-ping.sh`.
- **Six live runbooks** under `docs/runbooks/`: deploy, backup, incident,
  monitoring, llm-cost, webhook-rotation.
- **Control plane**:
  - `wlog status` local diagnostic.
  - `wlog admin {users, workspaces, tail, replay}` founder-only cross-workspace
    surface.
  - `docs/onboarding.md` employee install guide,
    `docs/control-plane.md` founder operator manual,
    `docs/calisanlar-icin.md` TR non-technical intro.
  - `scripts/install-wlog.sh` employee one-line installer.
- **Professional CLI UI pass** (ADR-0008):
  - `crates/wlog-cli/src/ui.rs` shared visual layer with semantic colors,
    Unicode status symbols, banner_heading, section, kv, divider,
    error/hint/warning, comfy-table builder.
  - Global `--quiet` / `--no-color` / `WLOG_QUIET` / `NO_COLOR` flags with
    AtomicI8 runtime override.
  - 9 unit tests covering redact_url, symbols, color/quiet overrides.
- **Diagnostic command family** (ADR-0009):
  - `wlog where` paths summary with password redaction.
  - `wlog about` build/version/license/target info.
  - `wlog doctor [--offline]` extended health check + docker container scan.
- **Operator subcommands**:
  - `wlog log [--limit] [--kind] [--all-workspaces]` recent events table.
  - `wlog tree <id> [--depth]` task DAG visualization with Unicode borders.
- **First-run UX**:
  - `wlog setup` interactive wizard for new installs.
- **Engine smoke**: `cargo run -p wlog-engine --example synth_one_batch`
  exercises Tera render + JSON decode without daemon/NATS/Postgres.
- **Commit hygiene**: `.githooks/commit-msg` rejects em dash anywhere
  in the message body.
- **ADR-0008** (CLI UI design system) and **ADR-0009** (diagnostic command
  family) accepted.

### Pending for v1.0.0

- 14 consecutive days of recursive dogfood (WienerLog tracking WienerLog).
- Synthesis correctness rated >= 85% on a 50-sample audit.
- Calibration MAPE <= 30% on completed-task estimates.
- Hetzner deployment live with Grafana + Loki + healthchecks.io.
- Security audit pass: cargo-audit clean, no high-severity CodeQL findings,
  secret scan clean.
- `v1.0.0` tag and signed GitHub Release.

## [0.1.0] - 2026-05-27 (code-complete, dogfood-ready)

### Added

#### Crates (nine)

- `wlog-cli` - the `wlog` binary with seventeen subcommands.
- `wlog-engine` - synthesis + triage + cost + dispatch + Solana checkpoint.
- `wlog-storage` - Postgres + pgvector access layer.
- `wlog-ingest-git` - git hook installer plus socket payload protocol.
- `wlog-ingest-cc` - Claude Code session probe with cursor.
- `wlog-ingest-gh` - GitHub webhook receiver (HMAC + replay LRU + Axum).
- `wlog-proto` - shared types and event contracts.
- `wlog-testutil` - internal test helpers, not published.
- `wlog-web` - read-only HTTP API over `wlog-storage`.

#### ADRs (eight, all Accepted)

- ADR-0000 license (AGPL-3.0-or-later).
- ADR-0001 Rust as primary language.
- ADR-0002 public repository flip and branch protection.
- ADR-0003 task DAG schema design.
- ADR-0004 embedding model and dimensionality (OpenAI text-embedding-3-small, 1536).
- ADR-0005 LLM client (hand-rolled `reqwest` Anthropic client).
- ADR-0006 prompt versioning strategy.
- ADR-0007 NATS subject hierarchy.

#### Schema

- Phase 0 migration: workspaces, users, tasks (vector(1536)), edges, events.
- Phase 1 + 2 migration: prompt_provenance JSONB, calibration_class, task_edits,
  estimations, completions.

#### Engine

- `LlmClient` trait with `AnthropicClient` (prompt caching, retries with jitter,
  Usage telemetry) and `MockLlmClient`.
- `EmbeddingProvider` trait with `OpenAiEmbedder` (batched, dimension guard) and
  `MockEmbedder` (SHA-256 deterministic vectors).
- `SynthesisEngine`: render `synthesis_v1.tera` and `triage_v1.tera`, complete
  via the LLM client, JSON salvage, `PromptProvenance` with input hash.
- `batch::Builder`: time + size windowed grouping by `(workspace, owner, repo)`.
- `consumer`: JetStream durable consumer that drains `wlog.*.event.>` into the
  `events` table.
- `cost::CostLedger` + `CostGuard`: per-call JSONL ledger + hard daily / rolling
  ceiling enforcement.
- `dispatch::classify`: keyword + node-type triage producing AgentEligible /
  HumanOnly / Ambiguous.
- `solana::merkle_root_of` + `NoopAnchor`: deterministic Merkle root and an
  anchor trait for the on-chain implementation that lands later.

#### Daemon

- `wlog daemon run` coordinates three workers: Unix socket listener (git hook
  payloads), CC session poller, GitHub webhook receiver.
- `PayloadSink` trait with `LoggingSink` (tests) and `NatsSink` (production)
  publishing to ADR-0007 subjects.
- Graceful SIGINT shutdown.

#### CLI surface

`wlog` subcommands: `init`, `add`, `ls`, `show`, `ack` (with `--edit` and
`--reject` recording calibration labels), `daily`, `search` (pgvector cosine
when `OPENAI_API_KEY` is set, substring fallback otherwise), `why`, `estimate`,
`done`, `stats`, `plan`, `dispatch`, `hooks {install,uninstall,status,notify}`,
`daemon {run,status}`, `cost`, `completions {bash,zsh,fish,powershell,elvish}`.

#### Infrastructure

- `infra/docker-compose.yml` for local development (Postgres + pgvector + NATS,
  SHA-256 pinned).
- `infra/hetzner/` skeleton: `cloud-init.yml`, `compose.prod.yml`, multi-stage
  `Dockerfile`, README runbook.
- `infra/caddy/Caddyfile` for production reverse proxy.

#### Tests

- 70+ unit tests across all crates.
- Four integration tests: storage `e2e`, daemon `daemon_e2e`, daemon `cc_e2e`,
  daemon `gh_e2e` (all testcontainers-driven).

### Known follow-ups (not blocking v0.1.0)

- Actions billing on the `wienerlabs` org blocked since 2026-05-23; CI green
  locally, not yet on the runner.
- Branch protection on `main` blocked by Free-plan limits on private repos
  (ADR-0002 documents the public-flip path).
- SSH signing key registration on the GitHub account pending OAuth scope refresh.
- `wlog daily` triggers the synthesis run via the engine library but does not
  yet spin a dedicated synth worker inside the daemon (the wiring is one
  follow-up patch).

## [0.0.1] - 2026-05-26 (genesis)

### Added

- Workspace scaffolding for all eight crates (`wlog-cli`, `wlog-engine`,
  `wlog-storage`, `wlog-ingest-{git,cc,gh}`, `wlog-proto`, `wlog-testutil`).
- Root governance documents: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- ADR template plus ADR-0000 (license) and ADR-0001 (primary language).
- CI workflows: lint, test, build, audit, deny, release, docs, security scan.
- `.github/` issue and PR templates, CODEOWNERS, Dependabot policy.
- Local development stack: Docker Compose with Postgres 16 + pgvector + NATS.
- Dev bootstrap and git hook installation scripts.

### Notes

Genesis release. CLI placeholders only; Phase 0 began after sign-off.
