import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS relics jsonb NOT NULL DEFAULT '[]'::jsonb`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS factions jsonb NOT NULL DEFAULT '{}'::jsonb`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS node_control jsonb NOT NULL DEFAULT '{}'::jsonb`;

await sql`UPDATE campaigns SET relics = '[]'::jsonb, factions = '{}'::jsonb, node_control = '{}'::jsonb`;
await sql`DELETE FROM frp_world_events`;

console.log("frp8 migration done: per-campaign relics/factions/node_control, world reset");
