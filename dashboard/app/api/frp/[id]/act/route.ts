import { getSession } from "@/lib/session";
import {
  getCampaign,
  getCharacters,
  getCharacter,
  appendTurn,
  updateCampaign,
  restartCampaign,
} from "@/lib/frp/db";
import { resolveTurn } from "@/lib/frp/engine";
import { OPENING_ACTION } from "@/lib/frp/prompts";
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
      await updateCampaign(
        campaignId,
        fields(campaign, {
          status: "active",
          turn_order: order,
          current_turn: order[0],
          round: 1,
          encounter: null,
        }),
      );
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
      await updateCampaign(campaignId, fields(campaign, { status: "ended" }));
      await appendTurn(campaignId, "system", "system", "Efsane burada sona erdi.", null, campaign.round);
      return Response.json({ ok: true });
    }
    if (body.control === "restart") {
      await restartCampaign(campaignId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "unknown control" }, { status: 400 });
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

  await appendTurn(campaignId, handle, "action", text, null, campaign.round);
  const r = await resolveTurn(campaignId, handle, text);
  return Response.json({ ok: r.ok, narration: r.narration, error: r.error });
}
