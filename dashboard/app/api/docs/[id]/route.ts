import { getSession, isAdmin } from "@/lib/session";
import { getDocument, updateDocument, deleteDocument } from "@/lib/db";

export const dynamic = "force-dynamic";

async function canEdit(
  id: number,
  me: string,
): Promise<{ ok: boolean; reason?: string }> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, reason: "not found" };
  if (doc.scope === "vault") return { ok: true };
  if (doc.author === me || (await isAdmin())) return { ok: true };
  return { ok: false, reason: "forbidden" };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  const id = Number((await params).id);
  const gate = await canEdit(id, me);
  if (!gate.ok) return new Response(gate.reason, { status: 403 });

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  await updateDocument(
    id,
    String(body.title || "Untitled").slice(0, 200),
    String(body.body || "").slice(0, 200000),
    me,
  );
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  const id = Number((await params).id);
  const gate = await canEdit(id, me);
  if (!gate.ok) return new Response(gate.reason, { status: 403 });
  await deleteDocument(id);
  return Response.json({ ok: true });
}
