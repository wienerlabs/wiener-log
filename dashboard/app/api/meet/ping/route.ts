import { getSession } from "@/lib/session";
import { meetPing, meetLeave } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  let body: { room?: string; leaving?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const room = String(body.room || "");
  if (!room) return Response.json({ ok: false }, { status: 400 });
  if (body.leaving) await meetLeave(room, me);
  else await meetPing(room, me);
  return new Response(null, { status: 204 });
}
