import { getSession } from "@/lib/session";
import {
  getCampaign,
  getCharacters,
  getCharacter,
  saveCharacter,
  appendTurn,
  updateCampaign,
  restartCampaign,
  lastActionText,
} from "@/lib/frp/db";
import { createNotification } from "@/lib/db";
import { resolveTurn } from "@/lib/frp/engine";
import { deleteWorldEvents } from "@/lib/frp/world";
import { OPENING_ACTION } from "@/lib/frp/prompts";
import { WORLD_MAP, areNeighbors } from "@/lib/frp/worldmap";
import { generateMap } from "@/lib/frp/mapgen";
import { reachable, hexesWithin, hexDistanceKey, visionRadius, moveBudget, advanceClock, isNight, biomeLabel, POI_KIND_TR } from "@/lib/frp/movement";
import type { Campaign } from "@/lib/frp/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

function fields(c: Campaign, o: Partial<Campaign> = {}) {
  return {
    status: o.status ?? c.status,
    current_scene: o.current_scene ?? c.current_scene,
    state_summary: o.state_summary ?? c.state_summary,
    turn_order: o.turn_order ?? c.turn_order,
    current_turn: o.current_turn !== undefined ? o.current_turn : c.current_turn,
    round: o.round ?? c.round,
    encounter: o.encounter !== undefined ? o.encounter : c.encounter,
    doom: o.doom ?? c.doom,
    quests: o.quests ?? c.quests,
    reputation: o.reputation ?? c.reputation,
    current_location: o.current_location !== undefined ? o.current_location : c.current_location,
    position: o.position !== undefined ? o.position : c.position,
    discovered: o.discovered ?? c.discovered,
    relics: o.relics ?? c.relics,
    factions: o.factions ?? c.factions,
    node_control: o.node_control ?? c.node_control,
    map_state: o.map_state ?? c.map_state,
  };
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
  const isHost = campaign.host === handle || session.role === "admin";
  const body = (await req.json()) as {
    control?: string;
    text?: string;
    mode?: string;
    travel?: string;
    hexTravel?: string;
  };

  if (body.control) {
    if (!isHost) return Response.json({ error: "host only" }, { status: 403 });
    if (body.control === "start") {
      if (campaign.status !== "lobby")
        return Response.json({ error: "already started" }, { status: 400 });
      const chars = await getCharacters(campaignId);
      if (chars.length < 1)
        return Response.json({ error: "need at least one character" }, { status: 400 });
      const order = chars.map((c) => c.handle);
      const startFields: Partial<Campaign> = {
        status: "active",
        turn_order: order,
        current_turn: order[0],
        round: 1,
        encounter: null,
      };
      if (campaign.map_seed) {
        const map = generateMap(campaign.map_seed);
        const startKey = `${map.start.q},${map.start.r}`;
        for (const c of chars) {
          c.location = startKey;
          await saveCharacter(c);
        }
        startFields.discovered = hexesWithin(map, startKey, 3);
        startFields.map_state = { time: 6, weather: "clear", discovered_pois: [] };
      }
      await updateCampaign(campaignId, fields(campaign, startFields));
      await appendTurn(
        campaignId,
        "system",
        "system",
        "Efsane başlıyor. Anlatıcı dünyayı açıyor.",
        null,
        1,
      );
      const r = await resolveTurn(campaignId, order[0], OPENING_ACTION, {
        isOpening: true,
      });
      return Response.json({ ok: r.ok });
    }
    if (body.control === "skip") {
      const chars = await getCharacters(campaignId);
      const living = campaign.turn_order.filter((h) =>
        chars.find((c) => c.handle === h && c.alive),
      );
      const idx = living.indexOf(campaign.current_turn || "");
      const next = living.length
        ? living[(idx + 1) % living.length]
        : campaign.current_turn;
      await appendTurn(
        campaignId,
        "gm",
        "system",
        `Anlatıcı, @${campaign.current_turn} oyuncusunun sırasını atlıyor.`,
        null,
        campaign.round,
      );
      await updateCampaign(campaignId, fields(campaign, { current_turn: next }));
      return Response.json({ ok: true });
    }
    if (body.control === "pause" || body.control === "resume") {
      await updateCampaign(
        campaignId,
        fields(campaign, { status: body.control === "pause" ? "paused" : "active" }),
      );
      return Response.json({ ok: true });
    }
    if (body.control === "end") {
      await updateCampaign(
        campaignId,
        fields(campaign, { status: "ended", doom: 0, relics: [], factions: {}, node_control: {} }),
      );
      await deleteWorldEvents(campaignId);
      await appendTurn(campaignId, "system", "system", "Efsane burada sona erdi. Bu evren sıfırlandı.", null, campaign.round);
      return Response.json({ ok: true });
    }
    if (body.control === "restart") {
      await restartCampaign(campaignId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "unknown control" }, { status: 400 });
  }

  if (body.travel) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    if (campaign.current_turn !== handle)
      return Response.json({ error: "not your turn" }, { status: 409 });
    if (campaign.encounter?.active)
      return Response.json({ error: "savaşta seyahat edilmez" }, { status: 400 });
    const dest = WORLD_MAP[body.travel];
    if (!dest) return Response.json({ error: "böyle bir yer yok" }, { status: 400 });
    const ch = await getCharacter(campaignId, handle);
    if (!ch || !ch.alive)
      return Response.json({ error: "no living character" }, { status: 400 });
    if (!ch.location || !areNeighbors(ch.location, dest.key))
      return Response.json({ error: "oraya buradan gidilmez" }, { status: 400 });
    await appendTurn(campaignId, handle, "action", `${dest.name} yönüne yola çıkıyorum.`, null, campaign.round);
    const r = await resolveTurn(campaignId, handle, `Takım ${dest.name} yönüne yola çıkıyor.`, { travelTo: dest.key });
    return Response.json({ ok: r.ok, narration: r.narration, error: r.error });
  }

  if (body.hexTravel) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    if (campaign.current_turn !== handle)
      return Response.json({ error: "not your turn" }, { status: 409 });
    if (!campaign.map_seed)
      return Response.json({ error: "bu oyunda harita yok" }, { status: 400 });
    if (campaign.encounter?.active)
      return Response.json({ error: "savaşta seyahat edilmez" }, { status: 400 });
    const ch = await getCharacter(campaignId, handle);
    if (!ch || !ch.alive)
      return Response.json({ error: "no living character" }, { status: 400 });
    const map = generateMap(campaign.map_seed);
    const mount = (ch.mount as "horse" | "boat" | null) || null;
    const reach = reachable(map, ch.location, moveBudget(ch.class, ch.class2, mount), mount);
    const dest = String(body.hexTravel);
    const cost = reach.get(dest);
    if (cost === undefined)
      return Response.json({ error: "oraya bu turda ulaşamazsın" }, { status: 400 });
    ch.location = dest;
    await saveCharacter(ch);

    const prev = campaign.map_state || {};
    const clock = advanceClock(
      { time: prev.time ?? 6, weather: prev.weather ?? "clear", discovered_pois: prev.discovered_pois ?? [] },
      cost,
      campaignId,
    );
    const destTile = map.tiles.find((t) => `${t.q},${t.r}` === dest)!;
    const night = isNight(clock.time);
    const revealed = new Set([
      ...(campaign.discovered || []),
      ...hexesWithin(map, dest, visionRadius(destTile, ch.class, ch.class2, night)),
    ]);
    const dp = new Set(clock.discovered_pois);
    for (const p of map.pois) if (p.hidden && hexDistanceKey(dest, `${p.q},${p.r}`) <= 1) dp.add(p.id);
    clock.discovered_pois = [...dp];

    await updateCampaign(campaignId, fields(campaign, { discovered: [...revealed], map_state: clock }));

    const poiHere = map.pois.find((p) => p.q === destTile.q && p.r === destTile.r);
    const visiblePoi = poiHere && (!poiHere.hidden || dp.has(poiHere.id)) ? poiHere : null;
    const notable = visiblePoi && ["dungeon", "boss", "sanctum", "capital", "sin_site", "wonder"].includes(visiblePoi.kind);
    const roll = (Math.imul((campaignId * 2654435761 + Math.floor(clock.time) * 40503 + dest.split(",").reduce((s, x) => s + Number(x), 0)) | 0, 2246822507) >>> 0) / 4294967296;
    const chance = destTile.danger / 160 + (night ? 0.05 : 0) + (clock.weather === "storm" || clock.weather === "fog" ? 0.05 : 0) + (campaign.doom || 0) / 600;
    const encounter = roll < chance;

    if (encounter || notable) {
      const framing = encounter
        ? `Takım ${biomeLabel(destTile.biome)} arazisine${visiblePoi ? ` (${visiblePoi.name} yakını)` : ""} varır varmaz aniden bir tehlikeyle karşılaşıyor; bir düşman ya da pusu belirir ve savaş başlıyor.`
        : `Takım ${visiblePoi!.name} mekanına (${POI_KIND_TR[visiblePoi!.kind]}) ulaştı. Burayı, atmosferini ve buradaki tehlike ya da fırsatı kısaca anlat.`;
      const r = await resolveTurn(campaignId, handle, framing, {});
      return Response.json({ ok: r.ok });
    }

    const line = visiblePoi ? `${ch.name}, ${visiblePoi.name} yakınına vardı.` : `${ch.name}, ${biomeLabel(destTile.biome)} boyunca ilerledi.`;
    await appendTurn(campaignId, "system", "system", line, null, campaign.round);
    const chars = await getCharacters(campaignId);
    const living = campaign.turn_order.filter((h) => chars.find((c) => c.handle === h && c.alive));
    let round = campaign.round;
    let next = handle;
    if (living.length) {
      const idx = living.indexOf(handle);
      const ni = (idx + 1) % living.length;
      next = living[ni];
      if (ni === 0) round += 1;
    }
    await updateCampaign(campaignId, fields(campaign, { current_turn: next, round, discovered: [...revealed], map_state: clock }));
    if (next && next !== handle) {
      try {
        await createNotification({ recipient: next, actor: "gm", kind: "frp_turn", body: `"${campaign.title}" efsanesinde sıra sende`, link: `/tavern/${campaignId}` });
      } catch {
        /* best effort */
      }
    }
    return Response.json({ ok: true });
  }

  const text = String(body.text || "").slice(0, 1500).trim();
  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  const mode = body.mode === "action" ? "action" : "talk";

  if (mode === "talk") {
    const member = await getCharacter(campaignId, handle);
    if (!member) return Response.json({ error: "not in this party" }, { status: 403 });
    await appendTurn(campaignId, handle, "talk", text, null, campaign.round);
    return Response.json({ ok: true });
  }

  if (campaign.status !== "active")
    return Response.json({ error: "campaign not active" }, { status: 400 });
  if (campaign.current_turn !== handle)
    return Response.json({ error: "not your turn" }, { status: 409 });
  const ch = await getCharacter(campaignId, handle);
  if (!ch || !ch.alive)
    return Response.json({ error: "no living character" }, { status: 400 });

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const prevAction = await lastActionText(campaignId, handle);
  if (prevAction && norm(prevAction) === norm(text)) {
    await appendTurn(campaignId, "gm", "system", "Aynı eylemi ard arda tekrarlayamazsın; farklı bir şey dene.", { warning: true }, campaign.round);
    return Response.json({ ok: false, error: "duplicate action" });
  }

  await appendTurn(campaignId, handle, "action", text, null, campaign.round);
  const r = await resolveTurn(campaignId, handle, text);
  return Response.json({ ok: r.ok, narration: r.narration, error: r.error });
}
