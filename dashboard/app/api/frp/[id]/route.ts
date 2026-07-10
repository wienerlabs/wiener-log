import { getSession } from "@/lib/session";
import { getCampaign, getCharacters, getTurns, updateCampaign, saveCharacter, deleteCampaign } from "@/lib/frp/db";
import { listWorldEvents } from "@/lib/frp/world";
import { needsOverworldHeal, healOverworldState } from "@/lib/frp/heal";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) return new Response("bad id", { status: 400 });
  const campaign = await getCampaign(campaignId);
  if (!campaign) return Response.json({ error: "yok" }, { status: 404 });
  const isHost = campaign.host === me(session);
  if (!isHost && session.role !== "admin")
    return Response.json({ error: "yalnızca kurucu silebilir" }, { status: 403 });
  if (campaign.status !== "lobby")
    return Response.json({ error: "başlamış efsane silinemez" }, { status: 400 });
  await deleteCampaign(campaignId);
  return Response.json({ ok: true });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId))
    return new Response("bad id", { status: 400 });
  const after = Number(new URL(req.url).searchParams.get("after") || "0");
  const [campaign, characters, turns, events] = await Promise.all([
    getCampaign(campaignId),
    getCharacters(campaignId),
    getTurns(campaignId, Number.isFinite(after) ? after : 0),
    listWorldEvents(campaignId, 8),
  ]);
  if (!campaign) return new Response("not found", { status: 404 });

  if (needsOverworldHeal(campaign, characters)) {
    const { fields: patch, charLocations } = healOverworldState(campaign, characters);
    const m = { ...campaign, ...patch };
    await updateCampaign(campaignId, {
      status: m.status,
      current_scene: m.current_scene,
      state_summary: m.state_summary,
      turn_order: m.turn_order,
      current_turn: m.current_turn,
      round: m.round,
      encounter: m.encounter,
      doom: m.doom,
      quests: m.quests,
      reputation: m.reputation,
      current_location: m.current_location,
      position: m.position,
      discovered: m.discovered,
      relics: m.relics,
      factions: m.factions,
      node_control: m.node_control,
      map_state: m.map_state,
    });
    const locById = new Map(charLocations.map((x) => [x.id, x.location]));
    for (const c of characters) {
      const nl = locById.get(c.id);
      if (nl) {
        c.location = nl;
        await saveCharacter(c);
      }
    }
    Object.assign(campaign, m);
  }

  const world = {
    doom: campaign.doom,
    relics: campaign.relics || [],
    factions: campaign.factions || {},
    node_control: campaign.node_control || {},
  };
  return Response.json({ campaign, characters, turns, world, events });
}
