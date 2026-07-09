import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";
import { touchSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifyToken(token, process.env.AUTH_SECRET || "");
  if (session?.sid) await touchSession(session.sid);
  return new Response(null, { status: 204 });
}
