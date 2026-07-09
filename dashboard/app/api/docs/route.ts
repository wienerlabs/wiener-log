import { getSession } from "@/lib/session";
import { createDocument } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  let body: { scope?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const scope = body.scope === "personal" ? "personal" : "vault";
  const id = await createDocument(me, scope, String(body.title || "").slice(0, 160));
  return Response.json({ ok: true, id });
}
