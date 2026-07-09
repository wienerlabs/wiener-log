import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS briefings (
    day date PRIMARY KEY,
    summary text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("cockpit migration done: briefings");
