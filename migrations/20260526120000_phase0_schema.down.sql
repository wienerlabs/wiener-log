-- Reverse of 20260526120000_phase0_schema.up.sql.
-- Drops everything Phase 0 introduced. Extensions are left in place
-- because other databases on the same instance may depend on them.

DROP TRIGGER IF EXISTS workspaces_touch_updated_at ON workspaces;
DROP TRIGGER IF EXISTS tasks_touch_updated_at ON tasks;
DROP FUNCTION IF EXISTS wlog_touch_updated_at();

DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS workspaces;

DROP TYPE IF EXISTS edge_type;
DROP TYPE IF EXISTS node_type;
