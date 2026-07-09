import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS documents (
    id bigserial PRIMARY KEY,
    title text NOT NULL DEFAULT 'Untitled',
    body text NOT NULL DEFAULT '',
    author text NOT NULL,
    scope text NOT NULL DEFAULT 'vault',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
  )`;
await sql`CREATE INDEX IF NOT EXISTS documents_scope_idx ON documents (scope, updated_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS documents_author_idx ON documents (author, updated_at DESC)`;

console.log("documents ready");
