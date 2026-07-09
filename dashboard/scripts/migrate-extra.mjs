import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS audit_log (
    id bigserial PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    target text,
    detail jsonb,
    at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC)`;

await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS github_url text`;

console.log("audit_log + tasks.github_url ready");
