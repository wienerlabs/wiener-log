-- Phase -1 placeholder migration. Real schema lands in Phase 0 sprint S0
-- per docs/adr/0002-task-dag-schema.md (to be authored).
--
-- This file exists so `sqlx::migrate!("../../migrations")` compiles before the
-- first real migration is written.

CREATE TABLE IF NOT EXISTS _wlog_genesis (
    id INTEGER PRIMARY KEY,
    note TEXT NOT NULL DEFAULT 'WienerLog Phase -1 genesis marker'
);
