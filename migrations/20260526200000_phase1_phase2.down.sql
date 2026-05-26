DROP TABLE IF EXISTS completions;
DROP TABLE IF EXISTS estimations;
DROP TABLE IF EXISTS task_edits;
DROP INDEX IF EXISTS tasks_workspace_class;
ALTER TABLE tasks DROP COLUMN IF EXISTS calibration_class;
ALTER TABLE tasks DROP COLUMN IF EXISTS prompt_provenance;
