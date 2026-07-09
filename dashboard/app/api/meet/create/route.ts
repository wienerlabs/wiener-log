import { getSession } from "@/lib/session";
import { createMeeting } from "@/lib/db";

export const dynamic = "force-dynamic";

function roomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let s = "";
  for (const b of bytes) s += (b % 36).toString(36);
  return `wienerlog-${s}`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  let body: { title?: string; room?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const room = (body.room || roomId()).slice(0, 80);
  await createMeeting(room, String(body.title || "").slice(0, 120), me);
  return Response.json({ ok: true, room });
}
