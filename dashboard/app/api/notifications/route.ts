import { getSession } from "@/lib/session";
import {
  getNotifications,
  unreadCount,
  markNotificationsRead,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function meOf(session: { handle: string; username: string }): string {
  return session.handle && session.handle !== "admin"
    ? session.handle
    : session.username;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me = meOf(session);
  const [notifications, unread] = await Promise.all([
    getNotifications(me),
    unreadCount(me),
  ]);
  return Response.json({ notifications, unread });
}

export async function POST() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  await markNotificationsRead(meOf(session));
  return Response.json({ ok: true });
}
