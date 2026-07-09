import { sql } from "@/lib/db";
import { HOUSES } from "@/lib/frp/houses";
import type { WorldEvent, Sin } from "@/lib/frp/types";

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

export async function listWorldEvents(
  campaignId: number,
  limit = 8,
): Promise<WorldEvent[]> {
  return (await sql`
    SELECT id, campaign_id, kind, text, house, created_at
    FROM frp_world_events
    WHERE campaign_id = ${campaignId}
    ORDER BY id DESC LIMIT ${limit}
  `) as WorldEvent[];
}

export async function deleteWorldEvents(campaignId: number): Promise<void> {
  await sql`DELETE FROM frp_world_events WHERE campaign_id = ${campaignId}`;
}

export function factionControl(
  factions: Record<string, number>,
  houseId: string,
): number {
  const v = factions?.[houseId];
  return typeof v === "number" ? v : 50;
}

export function relicSet(relics: Sin[]): Set<Sin> {
  return new Set(relics || []);
}

export function driftFactions(
  factions: Record<string, number>,
  seed: number,
): { factions: Record<string, number>; news: { text: string; house: string } | null } {
  const f: Record<string, number> = {};
  for (const h of HOUSES) f[h.id] = factionControl(factions, h.id);
  const gain = HOUSES[seed % HOUSES.length];
  const lose = HOUSES[(Math.floor(seed / 7) + 1) % HOUSES.length];
  if (gain.id === lose.id) return { factions: f, news: null };
  f[gain.id] = Math.min(100, f[gain.id] + 3);
  f[lose.id] = Math.max(0, f[lose.id] - 3);
  return {
    factions: f,
    news: { text: `${gain.name} orduları ${lose.name}'in sınırından toprak kopardı.`, house: gain.id },
  };
}
