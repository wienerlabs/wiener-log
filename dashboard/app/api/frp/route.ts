import { getSession } from "@/lib/session";
import { createCampaign, listCampaigns } from "@/lib/frp/db";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const campaigns = await listCampaigns(me(session));
  return Response.json({ campaigns });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const body = (await req.json()) as {
    title?: string;
    setting?: string;
    tone?: string;
    difficulty?: string;
    model?: string;
    seed?: string;
  };
  const title = String(body.title || "").slice(0, 120).trim();
  const setting = String(body.setting || "").slice(0, 2000).trim();
  if (!title || !setting)
    return Response.json({ error: "title and setting required" }, { status: 400 });
  const gm_model = ["claude-haiku-4-5", "claude-sonnet-4-5"].includes(body.model || "")
    ? (body.model as string)
    : "claude-haiku-4-5";
  const rawSeed = String(body.seed || "")
    .trim()
    .slice(0, 40)
    .replace(/[^\p{L}\p{N} _-]/gu, "");
  const map_seed = rawSeed || `w-${crypto.randomUUID().slice(0, 8)}`;
  const id = await createCampaign({
    title,
    setting,
    tone: String(body.tone || "").slice(0, 200).trim(),
    host: me(session),
    gm_model,
    difficulty: ["easy", "normal", "hard", "grim"].includes(body.difficulty || "")
      ? (body.difficulty as string)
      : "normal",
    map_seed,
  });
  return Response.json({ id });
}
