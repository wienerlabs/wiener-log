import { getSession } from "@/lib/session";
import { getCampaign, getCharacter, saveCharacter, appendTurn } from "@/lib/frp/db";
import { itemNameTr, stackInventory, removeFromInventory, USE_EFFECTS } from "@/lib/frp/items";

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
  if (!campaign) return Response.json({ error: "yok" }, { status: 404 });

  const ch = await getCharacter(campaignId, handle);
  if (!ch || !ch.alive)
    return Response.json({ error: "canlı karakter yok" }, { status: 400 });

  const body = (await req.json()) as { item?: string };
  const item = String(body.item || "");
  const eff = USE_EFFECTS[item];
  if (!eff) return Response.json({ error: "bu eşya kullanılamaz" }, { status: 400 });
  if (!stackInventory(ch.inventory || []).some((it) => it.id === item))
    return Response.json({ error: "elinde yok" }, { status: 400 });

  if (eff.hp && ch.hp_cur >= ch.hp_max)
    return Response.json({ error: "canın zaten dolu" }, { status: 400 });
  if (eff.mp && !eff.hp && ch.mp_cur >= ch.mp_max)
    return Response.json({ error: "manan zaten dolu" }, { status: 400 });

  const parts: string[] = [];
  if (eff.hp) {
    const healed = Math.min(eff.hp, ch.hp_max - ch.hp_cur);
    ch.hp_cur += healed;
    parts.push(`+${healed} can`);
  }
  if (eff.mp) {
    const restored = Math.min(eff.mp, ch.mp_max - ch.mp_cur);
    ch.mp_cur += restored;
    if (restored > 0) parts.push(`+${restored} mana`);
  }
  ch.inventory = removeFromInventory(ch.inventory, item, 1);
  await saveCharacter(ch);
  await appendTurn(
    campaignId,
    "system",
    "system",
    `${ch.name}, ${itemNameTr(item)} ${eff.label}${parts.length ? ` (${parts.join(", ")})` : ""}.`,
    null,
    campaign.round,
  );
  return Response.json({ ok: true });
}
