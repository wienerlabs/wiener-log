import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE project_suggestions ADD COLUMN IF NOT EXISTS suggested_assignee text`;

await sql`
  CREATE TABLE IF NOT EXISTS messages (
    id bigserial PRIMARY KEY,
    author text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS messages_id_idx ON messages (id DESC)`;

console.log("suggested_assignee + messages ready");
