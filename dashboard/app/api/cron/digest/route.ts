import { getDigestData, buildDigestMessage } from "@/lib/digest";
import { sendTelegram } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || "";
  return secret !== "" && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const data = await getDigestData();
  const sent = await sendTelegram(buildDigestMessage(data));
  return Response.json({
    ok: true,
    delivered: sent,
    stale_pulls: data.stalePulls.length,
    unassigned: data.unassigned.length,
    events_7d: data.events7d,
  });
}
