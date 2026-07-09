import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS project_suggestions (
    id bigserial PRIMARY KEY,
    repo text NOT NULL,
    title text NOT NULL,
    body text,
    status text NOT NULL DEFAULT 'open',
    github_url text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS project_suggestions_repo_idx
  ON project_suggestions (repo, status)`;

console.log("project_suggestions ready");
