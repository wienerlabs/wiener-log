import { sql } from "@/lib/db";
import type { WorldState, WorldEvent, Sin } from "@/lib/frp/types";

const DEFAULT_WORLD: WorldState = {
  doom: 0,
  factions: {},
  relics: [],
  node_control: {},
};

export async function getWorld(): Promise<WorldState> {
  const rows = (await sql`
    SELECT doom, factions, relics, node_control, updated_at
    FROM frp_world WHERE id = 1 LIMIT 1
  `) as WorldState[];
  const w = rows[0];
  if (!w) return { ...DEFAULT_WORLD };
  return {
    doom: w.doom ?? 0,
    factions: w.factions || {},
    relics: Array.isArray(w.relics) ? w.relics : [],
    node_control: w.node_control || {},
    updated_at: w.updated_at,
  };
}

export async function saveWorld(w: WorldState): Promise<void> {
  await sql`
    INSERT INTO frp_world (id, doom, factions, relics, node_control, updated_at)
    VALUES (1, ${w.doom}, ${JSON.stringify(w.factions)}::jsonb,
      ${JSON.stringify(w.relics)}::jsonb, ${JSON.stringify(w.node_control)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      doom = ${w.doom},
      factions = ${JSON.stringify(w.factions)}::jsonb,
      relics = ${JSON.stringify(w.relics)}::jsonb,
      node_control = ${JSON.stringify(w.node_control)}::jsonb,
      updated_at = now()
  `;
}

export async function addWorldEvent(
  campaignId: number | null,
  kind: string,
  text: string,
  house: string | null,
): Promise<void> {
  await sql`
    INSERT INTO frp_world_events (campaign_id, kind, text, house)
    VALUES (${campaignId}, ${kind}, ${text}, ${house})
  `;
}

export async function listWorldEvents(limit = 8): Promise<WorldEvent[]> {
  return (await sql`
    SELECT id, campaign_id, kind, text, house, created_at
    FROM frp_world_events ORDER BY id DESC LIMIT ${limit}
  `) as WorldEvent[];
}

export function factionControl(w: WorldState, houseId: string): number {
  const v = w.factions[houseId];
  return typeof v === "number" ? v : 50;
}

export function relicSet(w: WorldState): Set<Sin> {
  return new Set(w.relics);
}
