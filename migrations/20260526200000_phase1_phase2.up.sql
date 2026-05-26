-- Phase 1 #38 (task_edits) + Phase 2 estimations/completions + prompt_provenance.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prompt_provenance JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS calibration_class TEXT;
CREATE INDEX IF NOT EXISTS tasks_workspace_class ON tasks(workspace_id, calibration_class)
    WHERE calibration_class IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_edits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    editor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    field           TEXT NOT NULL,
    before          TEXT,
    after           TEXT,
    edited_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_edits_task ON task_edits(task_id);
CREATE INDEX IF NOT EXISTS task_edits_workspace_when ON task_edits(workspace_id, edited_at DESC);

CREATE TABLE IF NOT EXISTS estimations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    estimator       TEXT NOT NULL CHECK (estimator IN ('human', 'engine')),
    estimated_hours DOUBLE PRECISION NOT NULL CHECK (estimated_hours > 0),
    estimated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estimations_task ON estimations(task_id);
CREATE INDEX IF NOT EXISTS estimations_workspace_when ON estimations(workspace_id, estimated_at DESC);

CREATE TABLE IF NOT EXISTS completions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    task_id       UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    actual_hours  DOUBLE PRECISION NOT NULL CHECK (actual_hours > 0),
    completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS completions_workspace_when ON completions(workspace_id, completed_at DESC);
