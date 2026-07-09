import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    sid text PRIMARY KEY,
    username text NOT NULL,
    role text NOT NULL,
    handle text,
    ip text,
    user_agent text,
    login_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    logout_at timestamptz,
    logout_reason text
  )`;

await sql`
  CREATE INDEX IF NOT EXISTS auth_sessions_login_idx
  ON auth_sessions (login_at DESC)`;

const n = (await sql`SELECT count(*)::int AS n FROM auth_sessions`)[0].n;
console.log(`auth_sessions ready (${n} rows)`);
