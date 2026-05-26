# 0007: NATS subject hierarchy

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: ingestion, messaging, infrastructure

## Context and Problem Statement

Mandate §5.2 sketches a NATS subject hierarchy. Phase 1 wires the first
real producers (ingest-git, ingest-cc, ingest-gh) and the first real
consumer (engine synthesis worker). Subjects locked now propagate
through every later daemon, every replay tape, every dashboards query.

## Decision Drivers

- One subject per (source, kind) so that consumers can subscribe with
  wildcards (`wlog.*.event.git.>`) without parsing payload to filter.
- Workspace as a high-cardinality fan-out: every workspace owns its
  own subject namespace and JetStream consumers, so noisy neighbors do
  not block each other.
- Replay support: subjects must be replayable from a JetStream stream
  without losing the original ingestion timestamp.
- Forward compatibility: adding a new event kind must not require
  resubscribing existing consumers (wildcards do that).
- Symmetry between event subjects and result subjects: every command
  triggers a result on a parallel subject that the originator can
  await.

## Considered Options

1. **`wlog.{workspace}.{kind}.*`** (flat, kind first).
2. **`wlog.{workspace}.event.{source}.{kind}`** (mandate sketch).
3. **`wlog.events.{source}.{kind}.{workspace}`** (workspace last).
4. **Single subject `wlog` with payload-side discriminators**.

## Decision Outcome

**Chosen**: Option 2, the mandate sketch, with explicit conventions for
command and result subjects and JetStream stream definitions.

### Rationale

Option 1 collapses event vs command vs result distinction into the
payload, breaking the principle of one subject per (source, kind).
Option 3 puts workspace at the leaf, which breaks per-workspace
isolation in JetStream streams (a stream cannot subscribe to a
specific workspace easily). Option 4 is the trivial monolith and
loses every advantage of NATS subjects.

### Subject taxonomy

```
wlog.{workspace}.event.git.commit
wlog.{workspace}.event.git.branch
wlog.{workspace}.event.git.merge
wlog.{workspace}.event.git.push
wlog.{workspace}.event.cc.session_started
wlog.{workspace}.event.cc.session_message
wlog.{workspace}.event.cc.session_ended
wlog.{workspace}.event.gh.pr.opened
wlog.{workspace}.event.gh.pr.closed
wlog.{workspace}.event.gh.pr.merged
wlog.{workspace}.event.gh.pr.review
wlog.{workspace}.event.gh.issue.opened
wlog.{workspace}.event.gh.issue.closed
wlog.{workspace}.event.gh.issue.comment
wlog.{workspace}.event.gh.workflow.completed

wlog.{workspace}.command.synth.run          # trigger synthesis batch
wlog.{workspace}.command.dispatch.run       # Phase 3
wlog.{workspace}.command.calibrate.run      # Phase 2

wlog.{workspace}.result.synth.{batch_id}    # synthesis result
wlog.{workspace}.result.dispatch.{task_id}  # dispatch outcome
wlog.{workspace}.result.calibrate.{run_id}  # calibration update
```

`{workspace}` is the workspace slug (mandate §4.2 CHECK constraint
guarantees `^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$`). Slugs cannot contain
dots, so the subject hierarchy stays unambiguous.

### JetStream streams

| Stream | Subjects | Retention | Storage |
| ------ | -------- | --------- | ------- |
| `WLOG_EVENTS` | `wlog.*.event.>` | 30 days, max 10 GB | file |
| `WLOG_COMMANDS` | `wlog.*.command.>` | 24 hours | memory |
| `WLOG_RESULTS` | `wlog.*.result.>` | 7 days | file |

Events live longer because replay tapes (for prompt iteration and
calibration) read from them. Commands are ephemeral. Results live a
week so that an operator running `wlog daily` retrospectively can
inspect last week's synthesis runs.

### Consumer naming

Durable consumer name pattern: `<crate>-<role>-<workspace>`.

Examples:

- `engine-synth-{workspace}` consumes `wlog.{workspace}.event.>`
  filtered to `event.git.commit`, `event.cc.session_*`, `event.gh.pr.*`.
- `engine-triage-{workspace}` consumes the same stream with the same
  filter but a higher max-deliver to retry transient LLM failures.
- `dispatcher-{workspace}` consumes `wlog.{workspace}.command.dispatch.>`
  in Phase 3.

Consumers are created idempotently by the daemon on startup; a
manifest in `crates/wlog-engine/jetstream/manifest.toml` lists the
expected streams and consumers so `wlog-engine` can self-audit on
boot.

### Message envelope

Payloads ride a thin envelope so that producers can attach trace
context without consumers having to peek at the body:

```json
{
  "schema_version": 1,
  "id": "<uuid-v4>",
  "workspace_id": "<uuid>",
  "occurred_at": "2026-05-26T15:32:03.000Z",
  "trace": {
    "trace_id": "...",
    "span_id": "..."
  },
  "body": { /* source-specific payload */ }
}
```

`schema_version` lets us evolve the envelope without breaking
existing consumers; producers must bump it when changing the body
schema or the envelope itself.

### Consequences

- **Positive**: wildcards work cleanly; per-workspace isolation; clear
  command/result symmetry; replay tape source is `WLOG_EVENTS`.
- **Negative**: subject strings include the workspace slug, so renaming
  a workspace is a non-trivial migration. We accept this; workspaces
  are intended to be long-lived.
- **Risks**: a slug pattern relaxation later (allowing dots) would
  break the hierarchy. ADR-0003's CHECK constraint already forbids
  dots; any change to that constraint requires updating this ADR.

## Validation

Revisit if:

1. JetStream storage costs exceed $5/month per workspace at typical
   activity volumes. Move events to `r2` cold storage after 7 days.
2. Cross-workspace analytics needs emerge (very unlikely pre-v2). A
   dedicated stream pattern `wlog.global.*` lands then.
3. A new ingestion source (Linear, Slack, Discord) doubles the subject
   count. Acceptable; the hierarchy generalizes by adding source
   discriminators.

## Updates

None yet.
