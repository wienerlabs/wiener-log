import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS standups (
    handle text NOT NULL,
    day date NOT NULL,
    summary text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (handle, day)
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS user_status (
    handle text PRIMARY KEY,
    status text NOT NULL DEFAULT 'available',
    message text,
    until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS announcements (
    id bigserial PRIMARY KEY,
    author text NOT NULL,
    title text NOT NULL,
    body text,
    pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS objectives (
    id bigserial PRIMARY KEY,
    title text NOT NULL,
    owner text,
    period text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS key_results (
    id bigserial PRIMARY KEY,
    objective_id bigint NOT NULL,
    title text NOT NULL,
    progress int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

console.log("ops tables ready (standups, user_status, announcements, objectives, key_results)");
