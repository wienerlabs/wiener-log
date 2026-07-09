import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS campaigns (
    id bigserial PRIMARY KEY,
    title text NOT NULL,
    setting text NOT NULL,
    tone text,
    status text NOT NULL DEFAULT 'lobby',
    host text NOT NULL,
    gm_model text NOT NULL DEFAULT 'claude-sonnet-4-5',
    difficulty text NOT NULL DEFAULT 'normal',
    current_scene text,
    state_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    turn_order jsonb NOT NULL DEFAULT '[]'::jsonb,
    current_turn text,
    round int NOT NULL DEFAULT 0,
    encounter jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS characters (
    id bigserial PRIMARY KEY,
    campaign_id bigint NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    handle text NOT NULL,
    name text NOT NULL,
    class text NOT NULL,
    race text NOT NULL,
    level int NOT NULL DEFAULT 1,
    xp int NOT NULL DEFAULT 0,
    hp_cur int NOT NULL,
    hp_max int NOT NULL,
    mp_cur int NOT NULL,
    mp_max int NOT NULL,
    stats jsonb NOT NULL DEFAULT '{}'::jsonb,
    inventory jsonb NOT NULL DEFAULT '[]'::jsonb,
    status_effects jsonb NOT NULL DEFAULT '[]'::jsonb,
    corruption jsonb NOT NULL DEFAULT '{}'::jsonb,
    wielded text,
    abilities jsonb NOT NULL DEFAULT '[]'::jsonb,
    gold int NOT NULL DEFAULT 0,
    portrait_seed text NOT NULL,
    alive boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, handle)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS campaign_turns (
    id bigserial PRIMARY KEY,
    campaign_id bigint NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    actor text NOT NULL,
    kind text NOT NULL,
    content text,
    payload jsonb,
    round int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS campaign_turns_poll_idx ON campaign_turns (campaign_id, id)`;
await sql`CREATE INDEX IF NOT EXISTS characters_campaign_idx ON characters (campaign_id)`;

console.log("frp migration done: campaigns, characters, campaign_turns");
