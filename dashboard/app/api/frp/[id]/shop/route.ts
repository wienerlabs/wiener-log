import { getSession } from "@/lib/session";
import { getCampaign, getCharacter, saveCharacter, appendTurn } from "@/lib/frp/db";
import { getWorld } from "@/lib/frp/world";
import {
  itemPrice,
  sellPrice,
  priceWithDoom,
  itemNameTr,
  coinBreakdown,
  MARKET_STOCK,
  FORGE_STOCK,
  FORGE_UPGRADES,
} from "@/lib/frp/items";
import { WORLD_MAP, isMarket, isForge } from "@/lib/frp/worldmap";

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

  const node = campaign.position ? WORLD_MAP[campaign.position] : undefined;
  if (!node) return Response.json({ error: "burada pazar yok" }, { status: 400 });
  const market = isMarket(node.kind);
  const forge = isForge(node.kind);
  if (!market && !forge)
    return Response.json({ error: "burada alışveriş yok" }, { status: 400 });

  const ch = await getCharacter(campaignId, handle);
  if (!ch || !ch.alive)
    return Response.json({ error: "canlı karakter yok" }, { status: 400 });

  const body = (await req.json()) as { op?: string; item?: string; from?: string };
  const world = await getWorld();
  const doom = world.doom;

  if (body.op === "buy") {
    const item = String(body.item || "");
    const allowed =
      (market && MARKET_STOCK.includes(item)) || (forge && FORGE_STOCK.includes(item));
    if (!allowed) return Response.json({ error: "burada satılmıyor" }, { status: 400 });
    const cost = priceWithDoom(itemPrice(item), doom);
    if (cost <= 0) return Response.json({ error: "satılık değil" }, { status: 400 });
    if ((ch.gold || 0) < cost)
      return Response.json({ error: "altının yetmiyor" }, { status: 400 });
    ch.gold -= cost;
    ch.inventory = [...(ch.inventory || []), { id: item }];
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(item)} satın aldı (${coinStr(cost)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  if (body.op === "sell") {
    const item = String(body.item || "");
    const idx = (ch.inventory || []).findIndex((it) => it.id === item);
    if (idx < 0) return Response.json({ error: "elinde yok" }, { status: 400 });
    const gain = sellPrice(item);
    if (gain <= 0) return Response.json({ error: "satılamaz" }, { status: 400 });
    ch.inventory = ch.inventory.filter((_, i) => i !== idx);
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
    const idx = (ch.inventory || []).findIndex((it) => it.id === from);
    if (idx < 0) return Response.json({ error: "yükseltilecek parça yok" }, { status: 400 });
    const cost = priceWithDoom(u.cost, doom);
    if ((ch.gold || 0) < cost)
      return Response.json({ error: "altının yetmiyor" }, { status: 400 });
    ch.gold -= cost;
    ch.inventory = ch.inventory.filter((_, i) => i !== idx);
    ch.inventory.push({ id: u.to });
    await saveCharacter(ch);
    await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(from)} parçasını ${itemNameTr(u.to)} olarak dövdürdü (${coinStr(cost)}).`, null, campaign.round);
    return Response.json({ ok: true, gold: ch.gold });
  }

  return Response.json({ error: "bilinmeyen işlem" }, { status: 400 });
}
