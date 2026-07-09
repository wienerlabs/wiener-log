import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS position text`;
await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discovered jsonb NOT NULL DEFAULT '[]'::jsonb`;

await sql`
  CREATE TABLE IF NOT EXISTS frp_world (
    id int PRIMARY KEY,
    doom int NOT NULL DEFAULT 0,
    factions jsonb NOT NULL DEFAULT '{}'::jsonb,
    relics jsonb NOT NULL DEFAULT '[]'::jsonb,
    node_control jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  INSERT INTO frp_world (id, doom, factions, relics, node_control)
  VALUES (1, 0, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING
`;

await sql`
  CREATE TABLE IF NOT EXISTS frp_world_events (
    id serial PRIMARY KEY,
    campaign_id int,
    kind text NOT NULL,
    text text NOT NULL,
    house text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS frp_world_events_created ON frp_world_events (created_at DESC)`;

console.log("frp6 migration done: campaigns.position/discovered, frp_world, frp_world_events");
