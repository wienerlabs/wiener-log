# WienerLog Architecture

This document is the high-level orientation for new contributors. Detailed
decisions live in [ADRs](adr/); detailed runbooks live in
[runbooks/](runbooks/).

## Principles

1. **Recording friction equals zero.** A developer never opens a ticket.
   Everything the system knows comes from observing real artifacts (commits,
   sessions, GitHub events).
2. **Closed calibration loop.** Every ack, edit, and reject is a label.
   Synthesis prompts and estimation parameters evolve from those labels.
3. **Provenance first.** Every task node points at the source events. `wlog
   why <id>` is implementable on day one.
4. **CLI first.** Every capability ships in the terminal before it gets a
   web UI. The web surface is read-only initially.
5. **One binary per role.** Daemons and the CLI are separate binaries that
   share `wlog-proto`. No shared mutable state, no plugin host.

## Four tiers

### 1. Ingestion

| Adapter | Role |
| ------- | ---- |
| `wlog-ingest-git` | Installs git hooks; emits `git.commit`, `git.branch`, `git.merge`, `git.push` events |
| `wlog-ingest-cc` | Watches `~/.claude/projects/`; emits `cc.session_started`, `cc.session_message`, `cc.session_ended` |
| `wlog-ingest-gh` | HTTP receiver with HMAC verification; emits `gh.pr.*`, `gh.issue.*`, `gh.workflow.*` |

All adapters publish on NATS JetStream subjects of the form
`wlog.{workspace}.event.{source}.{kind}`. The subject hierarchy is fixed in
ADR-0005 (Phase 1).

### 2. Storage

- **Postgres 16 + pgvector** for OLTP and semantic retrieval. Tables:
  `workspaces`, `users`, `tasks`, `edges`, `events`, plus the estimation
  tables added in Phase 2. Migrations live in [`migrations/`](../migrations/).
- **Cloudflare R2** for object storage (large transcripts, snapshots).
  Wired in Phase 4.
- **Solana** for audit checkpoints. Weekly Merkle root anchor; planned in
  Phase 4.

### 3. Engine

The synthesis engine consumes events from NATS, batches them per `(user,
repo, time-window)`, and prompts the LLM to produce `TaskNodeProposal`s. The
calibration subsystem watches ack/edit/done events and updates per-tuple
posteriors. The dispatcher classifies acked tasks for autonomous execution
(Phase 3).

```text
event → triage → batch → synth → embed → store
                            ↓
                       calibration ← outcome
                            ↓
                       dispatch → subagent → outcome
```

### 4. Surface

- **`wlog` CLI**: primary surface. Subcommands per task lifecycle.
- **Editor LSP probe**: planned post-v1; surfaces task hints inline.
- **Web dashboard**: read-only initially. DAG visualizer, calibration
  scatter plot, sprint view, cross-repo dependency map. Phase 4.

## Cross-cutting concerns

### Cost discipline

Every LLM call is metered. Daily cost reports land in
[`reports/cost/YYYY-MM-DD.md`](../reports/cost/). Hard daily ceiling: $15
USD; rolling 7-day ceiling: $75 USD.

### Observability

- `tracing` everywhere, structured JSON in production.
- Loki for log aggregation, Grafana for dashboards (Phase 4).
- Healthchecks.io as the external uptime watcher.

### Security

- Webhook HMACs verified with constant-time comparison.
- Database credentials never logged.
- LLM responses sanitized for prompt injection before storing as task body.
- Solana keypair stored outside the repo and outside the host filesystem;
  signing happens through a hardware wallet or an HSM (Phase 4).

## What lives where

| Concern | Crate |
| ------- | ----- |
| Types crossing process boundaries | `wlog-proto` |
| Database access | `wlog-storage` |
| LLM orchestration, prompts | `wlog-engine` |
| Filesystem and webhook watchers | `wlog-ingest-{git,cc,gh}` |
| User-facing commands | `wlog-cli` |
| Test helpers | `wlog-testutil` (not published) |

If a piece of code does not fit any of these, it belongs in a new crate
with an ADR justifying its existence.
