import { generateForTopProjects } from "@/lib/suggest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || "";
  return secret !== "" && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const results = await generateForTopProjects(3);
    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
