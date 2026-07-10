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
import { deleteWorldEvents, addWorldEvent } from "@/lib/frp/world";
import { initSim, tickWorld, worldQuestsFrom } from "@/lib/frp/worldsim";
import { OPENING_ACTION } from "@/lib/frp/prompts";
import { WORLD_MAP, areNeighbors } from "@/lib/frp/worldmap";
import { generateMap } from "@/lib/frp/mapgen";
import { reachable, hexesWithin, hexDistanceKey, visionRadius, moveBudget, advanceClock, isNight, biomeLabel, POI_KIND_TR, geographyQuests } from "@/lib/frp/movement";
import { stackInventory, removeFromInventory, addToInventory, weaponDie, itemNameTr, coinBreakdown, UNARMED } from "@/lib/frp/items";
import { arenaReachable, battleMoveBudget, stepEnemies, isHighGround } from "@/lib/frp/battle";
import { abilityById, hasLoS, aoeHexes, inRange, rollDamage, enemyAttackPower, hasShield, isStunned, tickEnemyStatus } from "@/lib/frp/abilities";
import { axialDistance, parseKey } from "@/lib/frp/hex";
import type { Campaign, Quest, StatusEffect } from "@/lib/frp/types";

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
    camp?: boolean;
    battleMove?: string;
    battleAbility?: { ability?: string; target?: string };
    weapon?: string;
    give?: { to?: string; gold?: number; item?: string };
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
        startFields.map_state = initSim(map, { time: 6, weather: "clear", discovered_pois: [] });
        const geo = geographyQuests(map, startKey);
        if (geo.length) startFields.quests = [...(campaign.quests || []), ...geo];
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

    const justDone = (campaign.quests || []).filter((qq) => qq.status === "active" && qq.target === dest);
    const quests: Quest[] = justDone.length
      ? (campaign.quests || []).map((qq) => (qq.status === "active" && qq.target === dest ? { ...qq, status: "done" as const } : qq))
      : campaign.quests || [];
    for (const q of justDone) await appendTurn(campaignId, "system", "system", `Görev tamamlandı: ${q.title}.`, null, campaign.round);

    const clock = advanceClock(campaign.map_state || { time: 6, weather: "clear", discovered_pois: [] }, cost, campaignId);
    const destTile = map.tiles.find((t) => `${t.q},${t.r}` === dest)!;
    const night = isNight(clock.time);
    const revealed = new Set([
      ...(campaign.discovered || []),
      ...hexesWithin(map, dest, visionRadius(destTile, ch.class, ch.class2, night)),
    ]);
    const dp = new Set(clock.discovered_pois);
    for (const p of map.pois) if (p.hidden && hexDistanceKey(dest, `${p.q},${p.r}`) <= 1) dp.add(p.id);
    clock.discovered_pois = [...dp];

    await updateCampaign(campaignId, fields(campaign, { discovered: [...revealed], map_state: clock, quests }));

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

    const sim = tickWorld(map, clock, Math.floor(clock.time) + campaignId + campaign.round);
    for (const ev of sim.events) await addWorldEvent(campaignId, ev.kind, ev.text.slice(0, 160), ev.house);
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
    await updateCampaign(campaignId, fields(campaign, { current_turn: next, round, discovered: [...revealed], map_state: sim.mapState, quests: [...quests, ...worldQuestsFrom(sim.events, quests)] }));
    if (next && next !== handle) {
      try {
        await createNotification({ recipient: next, actor: "gm", kind: "frp_turn", body: `"${campaign.title}" efsanesinde sıra sende`, link: `/tavern/${campaignId}` });
      } catch {
        /* best effort */
      }
    }
    return Response.json({ ok: true });
  }

  if (body.camp) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    if (campaign.current_turn !== handle)
      return Response.json({ error: "not your turn" }, { status: 409 });
    if (!campaign.map_seed)
      return Response.json({ error: "burada kamp kurulmaz" }, { status: 400 });
    if (campaign.encounter?.active)
      return Response.json({ error: "savaşta kamp kurulmaz" }, { status: 400 });
    const ch = await getCharacter(campaignId, handle);
    if (!ch || !ch.alive)
      return Response.json({ error: "no living character" }, { status: 400 });
    const map = generateMap(campaign.map_seed);
    const chars = await getCharacters(campaignId);
    const here = chars.filter((c) => c.alive && c.location === ch.location);
    let anyFed = false;
    let anyHungry = false;
    for (const c of here) {
      const hasR = stackInventory(c.inventory || []).some((it) => it.id === "rations");
      c.hp_cur = Math.min(c.hp_max, c.hp_cur + (hasR ? 14 : 5));
      c.mp_cur = Math.min(c.mp_max, c.mp_cur + (hasR ? 12 : 4));
      if (hasR) {
        c.inventory = removeFromInventory(c.inventory, "rations", 1);
        anyFed = true;
      } else anyHungry = true;
      await saveCharacter(c);
    }
    const clock = advanceClock(campaign.map_state || { time: 6, weather: "clear", discovered_pois: [] }, 8, campaignId);
    const [aq, ar] = ch.location.split(",").map(Number);
    const tile = map.tiles.find((t) => t.q === aq && t.r === ar);
    const night = isNight(clock.time);
    const ambRoll = (Math.imul((campaignId * 40503 + Math.floor(clock.time) * 31 + aq * 7 + ar * 13) | 0, 2654435761) >>> 0) / 4294967296;
    const ambush = ambRoll < (tile ? tile.danger : 10) / 130 + (night ? 0.08 : 0);
    await appendTurn(campaignId, "system", "system", `Takım kamp kurdu ve dinlendi${anyFed ? " (azık tüketildi)" : ""}${anyHungry ? " (azık tükenmiş, aç kaldılar)" : ""}.`, null, campaign.round);

    if (ambush) {
      await updateCampaign(campaignId, fields(campaign, { map_state: clock }));
      const r = await resolveTurn(campaignId, handle, `Kamp gecenin köründe basılıyor; bir düşman ya da yaratık aniden saldırıyor ve savaş başlıyor.`, {});
      return Response.json({ ok: r.ok });
    }

    const sim = tickWorld(map, clock, Math.floor(clock.time) + campaignId + campaign.round);
    for (const ev of sim.events) await addWorldEvent(campaignId, ev.kind, ev.text.slice(0, 160), ev.house);
    const living = campaign.turn_order.filter((h) => chars.find((c) => c.handle === h && c.alive));
    let round = campaign.round;
    let next = handle;
    if (living.length) {
      const idx = living.indexOf(handle);
      const ni = (idx + 1) % living.length;
      next = living[ni];
      if (ni === 0) round += 1;
    }
    const campQuests = campaign.quests || [];
    await updateCampaign(campaignId, fields(campaign, { current_turn: next, round, map_state: sim.mapState, quests: [...campQuests, ...worldQuestsFrom(sim.events, campQuests)] }));
    if (next && next !== handle) {
      try {
        await createNotification({ recipient: next, actor: "gm", kind: "frp_turn", body: `"${campaign.title}" efsanesinde sıra sende`, link: `/tavern/${campaignId}` });
      } catch {
        /* best effort */
      }
    }
    return Response.json({ ok: true });
  }

  if (body.give) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    const to = String(body.give.to || "");
    if (!to) return Response.json({ error: "kime verileceği belirsiz" }, { status: 400 });
    const from = await getCharacter(campaignId, handle);
    if (!from || !from.alive) return Response.json({ error: "no living character" }, { status: 400 });
    if (to === handle) return Response.json({ error: "kendine veremezsin" }, { status: 400 });
    const dest = (await getCharacters(campaignId)).find((c) => c.handle === to);
    if (!dest || !dest.alive) return Response.json({ error: "öyle bir yoldaş yok" }, { status: 400 });
    if (from.location !== dest.location) return Response.json({ error: "aynı yerde değilsiniz" }, { status: 400 });
    const coinStr = (c: number) => {
      const b = coinBreakdown(c), p: string[] = [];
      if (b.gold) p.push(`${b.gold} altın`);
      if (b.silver) p.push(`${b.silver} gümüş`);
      if (b.copper || !p.length) p.push(`${b.copper} bakır`);
      return p.join(" ");
    };
    if (body.give.gold) {
      const amt = Math.max(1, Math.floor(body.give.gold));
      if ((from.gold || 0) < amt) return Response.json({ error: "altının yetmiyor" }, { status: 400 });
      from.gold -= amt;
      dest.gold = (dest.gold || 0) + amt;
      await saveCharacter(from);
      await saveCharacter(dest);
      await appendTurn(campaignId, "system", "system", `${from.name}, ${dest.name} için ${coinStr(amt)} bıraktı.`, null, campaign.round);
    } else if (body.give.item) {
      const item = String(body.give.item);
      const owned = stackInventory(from.inventory || []).find((it) => it.id === item);
      if (!owned || (owned.qty ?? 0) <= 0) return Response.json({ error: "elinde yok" }, { status: 400 });
      from.inventory = removeFromInventory(from.inventory, item, 1);
      dest.inventory = addToInventory(dest.inventory, item);
      await saveCharacter(from);
      await saveCharacter(dest);
      await appendTurn(campaignId, "system", "system", `${from.name}, ${dest.name} kişisine ${itemNameTr(item)} verdi.`, null, campaign.round);
    } else {
      return Response.json({ error: "ne verileceği belirsiz" }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  if (body.battleMove) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    if (campaign.current_turn !== handle)
      return Response.json({ error: "not your turn" }, { status: 409 });
    const arena = campaign.encounter?.active ? campaign.encounter.arena : undefined;
    if (!arena) return Response.json({ error: "savaş alanı yok" }, { status: 400 });
    const ch = await getCharacter(campaignId, handle);
    if (!ch || !ch.alive) return Response.json({ error: "no living character" }, { status: 400 });
    const from = arena.party[handle];
    if (!from) return Response.json({ error: "savaşta konumun yok" }, { status: 400 });
    if ((arena.moved || []).includes(handle))
      return Response.json({ error: "bu turda zaten mevzilendin; şimdi eylemini yaz" }, { status: 400 });
    const dest = String(body.battleMove);
    const reach = arenaReachable(arena, from, battleMoveBudget(ch.class, ch.class2));
    if (!reach.has(dest)) return Response.json({ error: "oraya bu hamlede ulaşamazsın" }, { status: 400 });
    const nextArena = { ...arena, party: { ...arena.party, [handle]: dest }, moved: [...(arena.moved || []), handle] };
    const nextEnc = { ...campaign.encounter!, arena: nextArena };
    await updateCampaign(campaignId, fields(campaign, { encounter: nextEnc }));
    await appendTurn(campaignId, "system", "combat", `${ch.name} savaş alanında mevzi değiştirdi.`, null, campaign.round);
    return Response.json({ ok: true });
  }

  if (body.battleAbility?.ability) {
    if (campaign.status !== "active")
      return Response.json({ error: "campaign not active" }, { status: 400 });
    if (campaign.current_turn !== handle)
      return Response.json({ error: "not your turn" }, { status: 409 });
    const enc = campaign.encounter;
    const arena = enc?.active ? enc.arena : undefined;
    if (!arena || !enc) return Response.json({ error: "savaş alanı yok" }, { status: 400 });
    const ch = await getCharacter(campaignId, handle);
    if (!ch || !ch.alive) return Response.json({ error: "no living character" }, { status: 400 });
    const ability = abilityById(String(body.battleAbility.ability), ch.abilities);
    if (!ability) return Response.json({ error: "böyle bir yeteneğin yok" }, { status: 400 });
    if ((ch.mp_cur || 0) < ability.mp) return Response.json({ error: "manan yetmiyor" }, { status: 400 });
    const from = arena.party[handle];
    if (!from) return Response.json({ error: "savaşta konumun yok" }, { status: 400 });

    const chars = await getCharacters(campaignId);
    const byHandle = new Map(chars.map((c) => [c.handle, c]));
    const enemies = enc.enemies;
    const target = ability.target === "self" ? from : String(body.battleAbility.target || "");
    if (!target) return Response.json({ error: "hedef seç" }, { status: 400 });

    if (ability.target === "enemy") {
      const idx = arena.enemies.findIndex((k) => k === target);
      if (idx < 0 || !(enemies[idx] && enemies[idx].hp > 0)) return Response.json({ error: "orada düşman yok" }, { status: 400 });
      if (!inRange(from, target, ability.range)) return Response.json({ error: "menzil dışı" }, { status: 400 });
      if (ability.needsLoS && !hasLoS(arena, from, target)) return Response.json({ error: "hedefe görüş hattın yok" }, { status: 400 });
    } else if (ability.target === "ally") {
      const ally = Object.entries(arena.party).find(([, k]) => k === target);
      if (!ally || !byHandle.get(ally[0])?.alive) return Response.json({ error: "orada müttefik yok" }, { status: 400 });
      if (!inRange(from, target, ability.range)) return Response.json({ error: "menzil dışı" }, { status: 400 });
    }

    const log: string[] = [];
    const saveChars = new Set<string>([handle]);
    const applyStatus = (list: StatusEffect[] | undefined, s: StatusEffect): StatusEffect[] => {
      const kept = (list || []).filter((x) => x.id !== s.id);
      kept.push({ id: s.id, label: s.label, turns: s.turns });
      return kept;
    };
    const salt = campaignId * 131 + campaign.round * 17 + handle.length * 7 + target.split(",").reduce((a, b) => a + Number(b), 0);
    const area = new Set(aoeHexes(target, ability.aoe));
    const highGround = isHighGround(arena.terrain[from]);

    if (ability.kind === "attack" || ability.kind === "spell") {
      let hitAny = false;
      enemies.forEach((e, i) => {
        if (e.hp <= 0 || !area.has(arena.enemies[i])) return;
        hitAny = true;
        const dmg = rollDamage(ability.power + (highGround ? 2 : 0), salt + i);
        e.hp = Math.max(0, e.hp - dmg);
        if (ability.status && e.hp > 0) e.status = applyStatus(e.status, ability.status);
        log.push(`${ch.name}, ${ability.tr} ile ${e.name} üzerine ${dmg} hasar${ability.status && e.hp > 0 ? ` (${ability.status.label})` : ""}${e.hp <= 0 ? " — düştü!" : ""}.`);
      });
      if (!hitAny) return Response.json({ error: "hedefte düşman yok" }, { status: 400 });
    } else if (ability.kind === "heal") {
      for (const [hnd, k] of Object.entries(arena.party)) {
        if (!area.has(k)) continue;
        const c = byHandle.get(hnd);
        if (!c || !c.alive) continue;
        const before = c.hp_cur;
        c.hp_cur = Math.min(c.hp_max, c.hp_cur + ability.power);
        saveChars.add(hnd);
        log.push(`${ch.name}, ${ability.tr} ile ${c.name} için ${c.hp_cur - before} can doldurdu.`);
      }
    } else if (ability.kind === "buff") {
      const targets = ability.target === "self" ? [handle] : Object.entries(arena.party).filter(([, k]) => area.has(k)).map(([h]) => h);
      for (const hnd of targets) {
        const c = byHandle.get(hnd);
        if (!c || !c.alive) continue;
        if (ability.status) {
          c.status_effects = applyStatus(c.status_effects, ability.status);
          saveChars.add(hnd);
        }
        log.push(`${c.name}, ${ability.status?.label || ability.tr} kazandı.`);
      }
    }

    ch.mp_cur = Math.max(0, (ch.mp_cur || 0) - ability.mp);
    const alive = () => enemies.filter((e) => e.hp > 0);
    let victory = alive().length === 0;

    if (!victory) {
      enemies.forEach((e) => {
        if (e.hp <= 0) return;
        const t = tickEnemyStatus(e.status);
        e.status = t.status;
        if (t.dmg) {
          e.hp = Math.max(0, e.hp - t.dmg);
          if (e.hp <= 0) log.push(`${e.name} durum etkisinden düştü.`);
        }
      });
      const partyAlive = () => Object.entries(arena.party).filter(([h]) => byHandle.get(h)?.alive);
      enemies.forEach((e, i) => {
        if (e.hp <= 0) return;
        if (isStunned(e.status)) {
          log.push(`${e.name} sersemledi, saldıramadı.`);
          return;
        }
        const ek = arena.enemies[i];
        if (!ek) return;
        const near = partyAlive().map(([h, k]) => ({ h, k, d: axialDistance(parseKey(ek), parseKey(k)) })).sort((a, b) => a.d - b.d)[0];
        if (!near || near.d > 1) return;
        const tgt = byHandle.get(near.h);
        if (!tgt) return;
        const shielded = hasShield(tgt.status_effects);
        let dmg = enemyAttackPower(e.hp_max) + (e.telegraph ? 2 : 0);
        if (shielded) dmg = Math.round(dmg * 0.5);
        tgt.hp_cur = Math.max(0, tgt.hp_cur - dmg);
        saveChars.add(near.h);
        log.push(`${e.name}, ${tgt.name} üzerine ${dmg} hasar${shielded ? " (kalkan yumuşattı)" : ""}${tgt.hp_cur <= 0 ? ` — ${tgt.name} düştü!` : ""}.`);
      });
      arena.enemies = stepEnemies(arena, enemies, campaign.map_seed || `c${campaignId}`, campaign.round);
      for (const c of chars) if (c.hp_cur <= 0 && c.alive) { c.alive = false; saveChars.add(c.handle); }
      victory = alive().length === 0;
    }

    if (victory) log.push("Son düşman da düştü. Savaş kazanıldı.");
    arena.moved = [];
    const nextEnc = victory ? null : { ...enc, arena, enemies };

    for (const h of saveChars) {
      const c = byHandle.get(h);
      if (c) await saveCharacter(c);
    }

    const livingParty = campaign.turn_order.filter((h) => byHandle.get(h)?.alive);
    let round = campaign.round;
    let next = handle;
    if (livingParty.length) {
      const idx = livingParty.indexOf(handle);
      const ni = (idx + 1) % livingParty.length;
      next = livingParty[ni];
      if (ni === 0) round += 1;
    }
    await updateCampaign(campaignId, fields(campaign, { encounter: nextEnc, current_turn: next, round }));
    for (const line of log.slice(0, 8)) await appendTurn(campaignId, "system", "combat", line, null, campaign.round);
    if (next && next !== handle) {
      try {
        await createNotification({ recipient: next, actor: "gm", kind: "frp_turn", body: `"${campaign.title}" efsanesinde sıra sende`, link: `/tavern/${campaignId}` });
      } catch {
        /* best effort */
      }
    }
    return Response.json({ ok: true, victory });
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
  let opts: Parameters<typeof resolveTurn>[3] = undefined;
  if (campaign.encounter?.active && body.weapon) {
    const unarmed = body.weapon === UNARMED.id;
    const die = weaponDie(unarmed ? null : body.weapon);
    const roll = 1 + ((Math.imul((campaignId * 2654435761 + campaign.round * 40503 + handle.length * 17 + text.length * 7) | 0, 2246822507) >>> 0) % die);
    opts = { weaponAttack: { name: unarmed ? UNARMED.tr : itemNameTr(body.weapon), die, roll, unarmed } };
  }
  const r = await resolveTurn(campaignId, handle, text, opts);
  return Response.json({ ok: r.ok, narration: r.narration, error: r.error });
}
