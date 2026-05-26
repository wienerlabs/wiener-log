# 0003: Task DAG schema design

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: storage, schema, postgres

## Context and Problem Statement

Phase 0 lands the schema that every later phase builds on. Decisions
made here propagate through ingestion, synthesis, calibration, dispatch,
and the web surface. Schema rework after Phase 1 means re-embedding,
re-classifying, and re-running calibration against historical data.

Mandate §4.2 ships a sketch. This ADR pins the open questions.

## Decision Drivers

- Multi-tenancy: every row must carry `workspace_id` so a single
  database can host many isolated workspaces without leaking cross-
  workspace data on a buggy query.
- Provenance must be cheap: `wlog why <id>` walks from a task to the
  events that produced it; the path must be a single indexed lookup.
- Calibration needs historical truth: status transitions cannot
  destroy prior state. Soft delete is incompatible with that goal
  unless paired with append-only history.
- Vector search arrives early: pgvector column lives on `tasks` from
  day one, even if many rows have a NULL embedding initially.
- Migrations should be reversible. Postgres enum types make migrations
  awkward (ALTER TYPE ADD VALUE is non-transactional pre-PG12; even
  on PG16 you cannot remove enum values without a migration dance).
- Keep the surface small: Phase 0 is five tables and one read path. The
  schema must not anticipate Phase 4 prematurely.

## Considered Options

### Option A: single tasks table + enum columns

One row per task; `node_type`, `status` are Postgres enum types.
Edges in a separate `edges` table. Events in a separate `events` table
with a nullable `task_id` FK.

### Option B: polymorphic tables per node_type

Separate `intents`, `decompositions`, `executions`, `outcomes` tables
sharing a common interface. Edges and events tables reference any of
them through a discriminator + ULID-style primary key.

### Option C: single tasks table + text columns

Same shape as A but `node_type`, `status` are CHECK-constrained TEXT
columns rather than enums.

### Option D: task graph as a JSONB blob per workspace

One row per workspace holding the full DAG as JSONB. Used by some
prototype tools.

## Decision Outcome

**Chosen**: Option A with one refinement: status is a TEXT column with
a CHECK constraint, while `node_type` and `edge_type` remain enums.

### Rationale

Option D is rejected: defeats indexing, defeats pgvector, defeats
provenance lookups. Suitable only for read-only prototypes.

Option B is rejected: four tables introduce four migration paths, four
read patterns, and four indexes for every cross-cutting query. The DAG
is queried as a graph more often than as four typed sets. Postgres does
not pay a meaningful cost for sparse columns on a single table.

Option C vs A on `status`: status values churn more than node or edge
kinds (we add `acked_with_edits`, `done_partial`, `superseded` over
time). CHECK constraints on TEXT survive that churn with a one-line
migration. We accept the smaller code-completion benefit of enums for
status; node_type and edge_type stay enums because their cardinality is
mandate-locked.

### Schema

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums (low-churn surface)
CREATE TYPE node_type AS ENUM (
    'intent',           -- a stated goal awaiting decomposition
    'decomposition',    -- a unit of work from decomposing an intent
    'execution',        -- a concrete attempt: commit cluster, agent run
    'outcome'           -- the observed result: merged PR, resolved bug
);

CREATE TYPE edge_type AS ENUM (
    'depends_on',
    'decomposes_into',
    'executes',
    'resolves'
);

-- Workspaces (tenancy root)
CREATE TABLE workspaces (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
    name         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (per-workspace identities)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    handle        TEXT NOT NULL,
    email         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, handle)
);
CREATE INDEX users_workspace ON users(workspace_id);

-- Tasks (DAG nodes)
CREATE TABLE tasks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_type      node_type NOT NULL,
    title          TEXT NOT NULL,
    body           TEXT,
    repo           TEXT,
    owner_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    status         TEXT NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed','acked','in_progress','done','rejected')),
    embedding      vector(1536),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX tasks_workspace_updated ON tasks(workspace_id, updated_at DESC);
CREATE INDEX tasks_workspace_repo ON tasks(workspace_id, repo) WHERE repo IS NOT NULL;
CREATE INDEX tasks_embedding_hnsw ON tasks USING hnsw (embedding vector_cosine_ops)
       WHERE embedding IS NOT NULL;

-- Edges (DAG relationships)
CREATE TABLE edges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_task     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    to_task       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    edge_type     edge_type NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_task, to_task, edge_type),
    CHECK (from_task <> to_task)
);
CREATE INDEX edges_from ON edges(from_task);
CREATE INDEX edges_to ON edges(to_task);

-- Events (raw activity)
CREATE TABLE events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source        TEXT NOT NULL CHECK (source IN ('git','claude_code','github')),
    kind          TEXT NOT NULL,
    payload       JSONB NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX events_workspace_occurred ON events(workspace_id, occurred_at DESC);
CREATE INDEX events_task ON events(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX events_workspace_source_kind ON events(workspace_id, source, kind);
```

### Open choices recorded

- **UUID v7 vs v4**: v4 from `gen_random_uuid()` for now. UUID v7
  (time-sortable) requires either a Postgres 18 builtin (not yet on
  pg16) or an extension. App-side generation costs us cross-language
  consistency. Defer to ADR-0007 once Phase 1 shows real event volume.
- **Soft delete**: rejected. Status `rejected` keeps the row visible
  to calibration; rows are never physically removed in Phase 0. A
  later ADR may introduce a `task_history` table for trail audit if
  status churn becomes lossy.
- **Multi-tenancy at the DB level**: `workspace_id` everywhere. Row
  Level Security (RLS) deferred to Phase 4 when the web surface lands;
  Phase 0 is single-tenant in practice and the CLI never crosses
  workspaces in a single session.
- **Embedding dimensionality**: `vector(1536)` matches the default in
  ADR-0004 (Voyage AI multilingual). Changing dimensionality means a
  full table rewrite, so ADR-0004 is locked-in before this migration
  ships.
- **Audit columns**: `created_at`, `updated_at` everywhere; no
  `created_by` in Phase 0 because solo. Added in Phase 1 when
  ingestion writes on behalf of users.

### Consequences

- **Positive**: simple read paths, single source of truth, pgvector
  on day one, foreign-key cascade aligns with workspace deletion.
- **Negative**: workspace deletion is destructive (ON DELETE CASCADE).
  Backup discipline is required before any test workspace cleanup. The
  ADR explicitly accepts this for the Phase 0 timeframe.
- **Risks**: enum migrations for `node_type` and `edge_type` if the
  mandate changes the four-node lifecycle. Mitigated by treating
  ADRs 0008+ as the change gate for any enum addition.

## Validation

Revisit if:

1. Phase 1 synthesis introduces a fifth lifecycle node or a fifth
   edge type. New ADR adds the value via `ALTER TYPE`.
2. Task volume exceeds 100K rows per workspace and HNSW recall degrades.
   Move embedding to a sidecar column store or to a separate `tasks_vec`
   table partitioned by month.
3. Calibration needs row-level audit beyond status snapshots. A
   `task_history` append-only table arrives in Phase 2 if so.
4. Workspace-cross queries appear (cross-org analytics). RLS lands and
   the CLI gains a global mode.

## Updates

None yet.
