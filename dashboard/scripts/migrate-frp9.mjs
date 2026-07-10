import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS map_seed text`;

console.log("frp9 migration done: campaigns.map_seed");
