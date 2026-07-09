import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS armor int NOT NULL DEFAULT 0`;

console.log("frp4 migration done: characters.armor");
