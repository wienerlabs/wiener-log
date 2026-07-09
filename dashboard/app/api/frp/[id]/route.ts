import { getSession } from "@/lib/session";
import { getCampaign, getCharacters, getTurns } from "@/lib/frp/db";
import { getWorld } from "@/lib/frp/world";

export const dynamic = "force-dynamic";

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
  const [campaign, characters, turns, world] = await Promise.all([
    getCampaign(campaignId),
    getCharacters(campaignId),
    getTurns(campaignId, Number.isFinite(after) ? after : 0),
    getWorld(),
  ]);
  if (!campaign) return new Response("not found", { status: 404 });
  return Response.json({ campaign, characters, turns, world });
}
