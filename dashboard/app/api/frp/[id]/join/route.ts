import { getSession } from "@/lib/session";
import {
  getCampaign,
  getCharacter,
  createCharacter,
  getCharacters,
  updateCampaign,
} from "@/lib/frp/db";
import { classById, raceById } from "@/lib/frp/classes";
import type { Stats } from "@/lib/frp/types";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const handle = me(session);
  const { id } = await params;
  const campaignId = Number(id);
  const campaign = await getCampaign(campaignId);
  if (!campaign) return new Response("not found", { status: 404 });
  if (campaign.status !== "lobby")
    return Response.json({ error: "campaign already started" }, { status: 400 });

  const body = (await req.json()) as { name?: string; cls?: string; race?: string };
  const cls = classById(String(body.cls || ""));
  const race = raceById(String(body.race || ""));
  if (!cls || !race)
    return Response.json({ error: "pick a class and race" }, { status: 400 });
  const name = String(body.name || "").slice(0, 40).trim() || `${handle}`;

  const existing = await getCharacter(campaignId, handle);
  if (existing) return Response.json({ ok: true });

  const stats: Stats = { ...cls.stats };
  for (const [k, v] of Object.entries(race.mods))
    stats[k as keyof Stats] += v as number;
  const hp = cls.hp + Math.max(0, stats.con - 10);
  const mp = cls.mp + Math.max(0, Math.floor((stats.int - 10) / 2));

  await createCharacter({
    campaign_id: campaignId,
    handle,
    name,
    cls: cls.id,
    race: race.id,
    hp,
    mp,
    stats: stats as unknown as Record<string, number>,
    inventory: cls.items.map((i) => ({ id: i })),
    abilities: [cls.ability],
    portrait_seed: `${name}:${cls.id}:${race.id}`,
  });

  const chars = await getCharacters(campaignId);
  const order = chars.map((c) => c.handle);
  await updateCampaign(campaignId, {
    status: campaign.status,
    current_scene: campaign.current_scene,
    state_summary: campaign.state_summary,
    turn_order: order,
    current_turn: campaign.current_turn,
    round: campaign.round,
    encounter: campaign.encounter,
  });

  return Response.json({ ok: true });
}
