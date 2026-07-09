import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'ocakkent'`;

console.log("frp7 migration done: characters.location");
