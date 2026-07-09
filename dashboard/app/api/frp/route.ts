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
  };
  const title = String(body.title || "").slice(0, 120).trim();
  const setting = String(body.setting || "").slice(0, 2000).trim();
  if (!title || !setting)
    return Response.json({ error: "title and setting required" }, { status: 400 });
  const id = await createCampaign({
    title,
    setting,
    tone: String(body.tone || "").slice(0, 200).trim(),
    host: me(session),
    gm_model: "claude-sonnet-4-5",
    difficulty: ["easy", "normal", "hard", "grim"].includes(body.difficulty || "")
      ? (body.difficulty as string)
      : "normal",
  });
  return Response.json({ id });
}
