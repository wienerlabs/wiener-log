import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS api_tokens (
    id bigserial PRIMARY KEY,
    handle text NOT NULL,
    name text,
    kind text NOT NULL DEFAULT 'ingest',
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
  )`;
await sql`CREATE INDEX IF NOT EXISTS api_tokens_hash_idx ON api_tokens (token_hash)`;

await sql`
  CREATE TABLE IF NOT EXISTS invitations (
    token text PRIMARY KEY,
    handle text,
    email text,
    role text NOT NULL DEFAULT 'employee',
    invited_by text,
    accepted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

console.log("api_tokens + invitations ready");
