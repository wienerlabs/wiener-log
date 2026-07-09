import { getSession } from "@/lib/session";
import { getCampaign, getCharacter, saveCharacter, appendTurn } from "@/lib/frp/db";
import { itemById, itemNameTr, stackInventory } from "@/lib/frp/items";

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

  if (!item || item === ch.wielded) {
    ch.wielded = null;
    await saveCharacter(ch);
    return Response.json({ ok: true, wielded: null });
  }

  const owned = stackInventory(ch.inventory || []).some((it) => it.id === item);
  if (!owned) return Response.json({ error: "bu eşya elinde yok" }, { status: 400 });
  const def = itemById(item);
  if (!def || def.category !== "weapon")
    return Response.json({ error: "bu bir silah değil" }, { status: 400 });

  ch.wielded = item;
  await saveCharacter(ch);
  await appendTurn(campaignId, "system", "system", `${ch.name}, ${itemNameTr(item)} kuşandı.`, null, campaign.round);
  return Response.json({ ok: true, wielded: item });
}
