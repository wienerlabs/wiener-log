import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS doom int NOT NULL DEFAULT 0`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS quests jsonb NOT NULL DEFAULT '[]'::jsonb`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reputation jsonb NOT NULL DEFAULT '{}'::jsonb`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_location text`;

console.log("frp5 migration done: campaigns.doom, quests, reputation, current_location");
