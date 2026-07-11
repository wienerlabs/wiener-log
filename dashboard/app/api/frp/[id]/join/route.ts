import { getSession } from "@/lib/session";
import {
  getCampaign,
  getCharacter,
  createCharacter,
  getCharacters,
  updateCampaign,
} from "@/lib/frp/db";
import { classById, raceById, CLASS_COIN, RACE_ITEMS } from "@/lib/frp/classes";
import { houseById } from "@/lib/frp/houses";
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

  const body = (await req.json()) as {
    name?: string;
    cls?: string;
    cls2?: string | null;
    race?: string;
    gender?: string;
    trait?: string;
    house?: string;
    shiftForm?: string;
  };
  const gender = ["female", "male", "nonbinary"].includes(String(body.gender)) ? String(body.gender) : "unspecified";
  const house = body.house ? houseById(String(body.house)) : null;
  const cls = classById(String(body.cls || ""));
  const race = raceById(String(body.race || ""));
  if (!cls || !race)
    return Response.json({ error: "pick a class and race" }, { status: 400 });
  const name = String(body.name || "").slice(0, 40).trim() || `${handle}`;
  const trait = String(body.trait || "").slice(0, 24).trim();

  const dualAllowed =
    campaign.difficulty === "easy" || campaign.difficulty === "normal";
  const cls2raw = body.cls2 ? classById(String(body.cls2)) : null;
  const cls2 = dualAllowed && cls2raw && cls2raw.id !== cls.id ? cls2raw : null;

  const existing = await getCharacter(campaignId, handle);
  if (existing) return Response.json({ ok: true });

  const stats: Stats = { ...cls.stats };
  if (cls2)
    for (const k of Object.keys(stats) as (keyof Stats)[])
      stats[k] = Math.max(stats[k], cls2.stats[k]);
  for (const [k, v] of Object.entries(race.mods))
    stats[k as keyof Stats] += v as number;

  const baseHp = cls2 ? Math.round((cls.hp + cls2.hp) / 2) : cls.hp;
  const baseMp = cls2 ? Math.round((cls.mp + cls2.mp) / 2) : cls.mp;
  const hp = baseHp + Math.max(0, stats.con - 10);
  const mp = baseMp + Math.max(0, Math.floor((stats.int - 10) / 2));

  const raceItems = RACE_ITEMS[race.id] || [];
  const items = [
    ...new Set([...cls.items, ...(cls2 ? cls2.items : []), ...raceItems]),
  ]
    .slice(0, 8)
    .map((i) => ({ id: i }));

  let coin = CLASS_COIN[cls.id] ?? 40;
  if (cls2) coin = Math.round((coin + (CLASS_COIN[cls2.id] ?? 40)) / 2);

  const abilities = [cls.ability];
  if (cls2) abilities.push(cls2.ability);
  if (trait) abilities.push(`Tabiat: ${trait}`);
  const isTamer = cls.id === "tamer" || cls2?.id === "tamer";
  const shiftForm = isTamer ? String(body.shiftForm || "").slice(0, 20).trim() : "";
  if (shiftForm) abilities.push(`Şekil: ${shiftForm}`);

  await createCharacter({
    campaign_id: campaignId,
    handle,
    name,
    cls: cls.id,
    cls2: cls2 ? cls2.id : null,
    race: race.id,
    gender,
    house: house ? house.id : null,
    hp,
    mp,
    coin,
    stats: stats as unknown as Record<string, number>,
    inventory: items,
    abilities,
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
