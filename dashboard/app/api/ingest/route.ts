import { ingestEvent } from "@/lib/ingest";
import { findTokenOwner } from "@/lib/tokens";

export const dynamic = "force-dynamic";

function bearerOf(req: Request): string {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

export async function POST(req: Request) {
  const bearer = bearerOf(req);
  let forcedHandle: string | null = null;
  const shared = process.env.INGEST_TOKEN || "";
  if (!bearer || bearer !== shared) {
    forcedHandle = await findTokenOwner(bearer, "ingest");
    if (!forcedHandle) return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { handle, source, kind, ...rest } = body as {
    handle?: string;
    source?: string;
    kind?: string;
  } & Record<string, unknown>;

  const ok = await ingestEvent({
    handle: forcedHandle || String(handle || ""),
    source: String(source || ""),
    kind: String(kind || ""),
    payload: rest,
  });
  return ok
    ? new Response(null, { status: 204 })
    : Response.json({ ok: false, error: "invalid event" }, { status: 400 });
}
