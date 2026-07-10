import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS mount text`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS map_state jsonb NOT NULL DEFAULT '{}'::jsonb`;

console.log("frp10 migration done: characters.mount, campaigns.map_state");
