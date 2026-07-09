import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS meetings (
    id bigserial PRIMARY KEY,
    room text UNIQUE NOT NULL,
    title text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS meeting_participants (
    room text NOT NULL,
    handle text NOT NULL,
    last_seen timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (room, handle)
  )`;
await sql`CREATE INDEX IF NOT EXISTS meeting_participants_seen_idx ON meeting_participants (room, last_seen)`;

console.log("meetings + meeting_participants ready");
