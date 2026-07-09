import { getSession } from "@/lib/session";
import { toggleReaction } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  let body: { messageId?: number; emoji?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const messageId = Number(body.messageId);
  const emoji = String(body.emoji || "").slice(0, 8);
  if (!Number.isFinite(messageId) || !emoji) {
    return Response.json({ ok: false }, { status: 400 });
  }
  await toggleReaction(messageId, me, emoji);
  return Response.json({ ok: true });
}
