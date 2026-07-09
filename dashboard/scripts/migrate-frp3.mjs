import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS house text`;

console.log("frp3 migration done: characters.house");
