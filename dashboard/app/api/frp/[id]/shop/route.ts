import { getSession } from "@/lib/session";
import { getCampaign, getCharacter, saveCharacter, appendTurn } from "@/lib/frp/db";
import {
  itemPrice,
  sellPrice,
  priceWithDoom,
  itemNameTr,
  coinBreakdown,
  addToInventory,
  removeFromInventory,
  stackInventory,
  MARKET_STOCK,
  FORGE_STOCK,
  FORGE_UPGRADES,
  MOUNT_PRICE,
  MOUNT_TR,
} from "@/lib/frp/items";
import { WORLD_MAP, isMarket, isForge } from "@/lib/frp/worldmap";
import { generateMap } from "@/lib/frp/mapgen";
import { armyNear, effectiveHouse } from "@/lib/frp/worldsim";
import { houseById } from "@/lib/frp/houses";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

function coinStr(c: number): string {
  const b = coinBreakdown(c);
  const p: string[] = [];
  if (b.gold) p.push(`${b.gold} altın`);
  if (b.silver) p.push(`${b.silver} gümüş`);
  if (b.copper || !p.length) p.push(`${b.copper} bakır`);
  return p.join(" ");
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
  if (!campaign) return Response.json({ error: "yok" }, { status: 404 });
  if (campaign.status !== "active")
    return Response.json({ error: "oyun aktif değil" }, { status: 400 });

  const ch = await getCharacter(campaignId, handle);
  if (!ch || !ch.alive)
    return Response.json({ error: "canlı karakter yok" }, { status: 400 });

  let market = false;
  let forge = false;
  let econMult = 1;
  let econNote = "";
  let refused = false;
  const omap = campaign.map_seed ? generateMap(campaign.map_seed) : null;
  if (omap) {
    const [q, r] = (ch.location || "").split(",").map(Number);
    const poi = omap.pois.find((p) => p.q === q && p.r === r);
    if (poi) {
      market = poi.kind === "market" || poi.kind === "capital";
      forge = poi.kind === "forge" || poi.kind === "capital";
    }
    const tile = omap.tiles.find((t) => t.q === q && t.r === r);
    const house = effectiveHouse(campaign.map_state?.control, tile?.region ?? null);
    const rep = house ? campaign.reputation?.[house] ?? 0 : 0;
    if (ch.location && armyNear(campaign.map_state || {}, ch.location, 4)) {
      econMult *= 1.3;
      econNote = "savaş fiyatları";
    }
    if (rep <= -60) {
      refused = true;
      econNote = `${house ? houseById(house)?.name || house : "bu hanedan"} seni topraklarında istemiyor`;
    } else if (rep < -20) {
      econMult *= 1.3;
      econNote = econNote || "hoş karşılanmıyorsun";
    } else if (rep > 40) {
      econMult *= 0.85;
      econNote = econNote || "müttefik indirimi";
    }
  } else {
    const node = ch.location ? WORLD_MAP[ch.location] : undefined;
    if (node) {
      market = isMarket(node.kind);
      forge = isForge(node.kind);
    }
  }
  if (!market && !forge)
    return Response.json({ error: "burada alışveriş/hizmet yok" }, { status: 400 });

  const body = (await req.json()) as { op?: string; item?: string; from?: string };
  const doom = campaign.doom;
  const econ = (base: number) => Math.max(1, Math.round(base * econMult));

  if (body.op === "buy") {
    if (refused) return Response.json({ error: econNote }, { status: 400 });
    const item = String(body.item || "");
    const allowed =
      (market && MARKET_STOCK.includes(item)) || (forge && FORGE_STOCK.includes(item));
    if (!allowed) return Response.json({ error: "burada satılmıyor" }, { status: 400 });
    const cost = econ(priceWithDoom(itemPrice(item), doom));
    if (cost <= 0) return Response.json({ error: "satılık değil" }, { status: 400 });
    if ((ch.gold || 0) < cost)
      return Response.json({ error: "altının yetmiyor" }, { status: 400 });
    ch.gold -= cost;
    ch.inventory = addToInventory(ch.inventory, item);
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(item)} satın aldı (${coinStr(cost)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "sell") {
    const item = String(body.item || "");
    const owned = stackInventory(ch.inventory).find((it) => it.id === item);
    if (!owned || (owned.qty ?? 0) <= 0) return Response.json({ error: "elinde yok" }, { status: 400 });
    const gain = sellPrice(item);
    if (gain <= 0) return Response.json({ error: "satılamaz" }, { status: 400 });
    ch.inventory = removeFromInventory(ch.inventory, item, 1);
    ch.gold = (ch.gold || 0) + gain;
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(item)} sattı (+${coinStr(gain)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "upgrade") {
    if (!forge) return Response.json({ error: "burada demirci yok" }, { status: 400 });
    const from = String(body.from || "");
    const u = FORGE_UPGRADES.find((x) => x.from === from);
    if (!u) return Response.json({ error: "yükseltme yok" }, { status: 400 });
    const owned = stackInventory(ch.inventory).find((it) => it.id === from);
    if (!owned || (owned.qty ?? 0) <= 0) return Response.json({ error: "yükseltilecek parça yok" }, { status: 400 });
    if (refused) return Response.json({ error: econNote }, { status: 400 });
    const cost = econ(priceWithDoom(u.cost, doom));
    if ((ch.gold || 0) < cost)
      return Response.json({ error: "altının yetmiyor" }, { status: 400 });
    ch.gold -= cost;
    ch.inventory = addToInventory(removeFromInventory(ch.inventory, from, 1), u.to);
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(from)} parçasını ${itemNameTr(u.to)} olarak dövdürdü (${coinStr(cost)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "mint") {
    if (!market) return Response.json({ error: "burada sarraf yok" }, { status: 400 });
    if ((ch.gold || 0) < 100)
      return Response.json({ error: "en az 100 bakır gerek" }, { status: 400 });
    ch.gold -= 100;
    ch.inventory = addToInventory(ch.inventory, "gold_pouch");
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, 100 bakırı bir altın keseye çevirdi.`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "melt") {
    const owned = stackInventory(ch.inventory).find((it) => it.id === "gold_pouch");
    if (!owned || (owned.qty ?? 0) <= 0)
      return Response.json({ error: "bozdurulacak kese yok" }, { status: 400 });
    ch.inventory = removeFromInventory(ch.inventory, "gold_pouch", 1);
    ch.gold = (ch.gold || 0) + 100;
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, bir altın keseyi 100 bakıra bozdurdu.`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "mount") {
    if (!market) return Response.json({ error: "burada ahır yok" }, { status: 400 });
    const kind = String(body.item || "");
    const base = MOUNT_PRICE[kind];
    if (!base) return Response.json({ error: "böyle bir binek yok" }, { status: 400 });
    if (refused) return Response.json({ error: econNote }, { status: 400 });
    const cost = econ(priceWithDoom(base, doom));
    if ((ch.gold || 0) < cost) return Response.json({ error: "altının yetmiyor" }, { status: 400 });
    ch.gold -= cost;
    ch.mount = kind;
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, bir ${MOUNT_TR[kind]} edindi (${coinStr(cost)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  return Response.json({ error: "bilinmeyen işlem" }, { status: 400 });
}
