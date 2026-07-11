import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'unspecified'`;

console.log("frp11 migration done: characters.gender");
