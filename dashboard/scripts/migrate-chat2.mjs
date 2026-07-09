import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user'`;

await sql`
  CREATE TABLE IF NOT EXISTS message_reactions (
    message_id bigint NOT NULL,
    handle text NOT NULL,
    emoji text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, handle, emoji)
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS notifications (
    id bigserial PRIMARY KEY,
    recipient text NOT NULL,
    actor text,
    kind text NOT NULL,
    body text,
    link text,
    message_id bigint,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient, read, id DESC)`;

console.log("chat2 schema ready (messages.kind, message_reactions, notifications)");
