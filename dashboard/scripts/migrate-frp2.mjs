import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS class2 text`;
await sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS controlled_by text`;

console.log("frp2 migration done: characters.class2, characters.controlled_by");
