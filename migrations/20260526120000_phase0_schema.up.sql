-- WienerLog Phase 0 schema.
-- See docs/adr/0003-task-dag-schema.md for the decision record.
-- This is a reversible migration; the matching .down.sql restores the
-- pre-Phase-0 state by dropping everything it creates.

-- Extensions ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums --------------------------------------------------------------
CREATE TYPE node_type AS ENUM (
    'intent',
    'decomposition',
    'execution',
    'outcome'
);

CREATE TYPE edge_type AS ENUM (
    'depends_on',
    'decomposes_into',
    'executes',
    'resolves'
);

-- Workspaces ---------------------------------------------------------
CREATE TABLE workspaces (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       TEXT UNIQUE NOT NULL
               CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE workspaces IS
    'Tenancy root. Every other row carries workspace_id and cascades on delete.';

-- Users --------------------------------------------------------------
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    handle       TEXT NOT NULL,
    email        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, handle)
);
CREATE INDEX users_workspace ON users(workspace_id);
COMMENT ON TABLE users IS
    'Per-workspace identities. Handles unique within a workspace, not globally.';

-- Tasks --------------------------------------------------------------
CREATE TABLE tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_type     node_type NOT NULL,
    title         TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 280),
    body          TEXT,
    repo          TEXT,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status        TEXT NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','acked','in_progress','done','rejected')),
    embedding     vector(1536),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_workspace_status  ON tasks(workspace_id, status);
CREATE INDEX tasks_workspace_updated ON tasks(workspace_id, updated_at DESC);
CREATE INDEX tasks_workspace_repo    ON tasks(workspace_id, repo) WHERE repo IS NOT NULL;
CREATE INDEX tasks_owner             ON tasks(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX tasks_embedding_hnsw
    ON tasks USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
COMMENT ON TABLE tasks IS
    'DAG nodes. Embedding column is nullable; embeddings are populated by the engine.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION wlog_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_touch_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION wlog_touch_updated_at();

CREATE TRIGGER workspaces_touch_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION wlog_touch_updated_at();

-- Edges --------------------------------------------------------------
CREATE TABLE edges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_task    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    to_task      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    edge_type    edge_type NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_task, to_task, edge_type),
    CHECK (from_task <> to_task)
);
CREATE INDEX edges_from ON edges(from_task);
CREATE INDEX edges_to   ON edges(to_task);
COMMENT ON TABLE edges IS 'Directed edges between tasks. Cycle prevention is an engine-layer concern.';

-- Events -------------------------------------------------------------
CREATE TABLE events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source       TEXT NOT NULL CHECK (source IN ('git','claude_code','github')),
    kind         TEXT NOT NULL,
    payload      JSONB NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX events_workspace_occurred    ON events(workspace_id, occurred_at DESC);
CREATE INDEX events_task                  ON events(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX events_workspace_source_kind ON events(workspace_id, source, kind);
COMMENT ON TABLE events IS 'Raw activity ingested by the wlog-ingest-* daemons. task_id is set retrospectively.';
