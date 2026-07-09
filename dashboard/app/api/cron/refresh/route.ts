import { refreshGithubData } from "@/lib/refresh";
import { generateForTopProjects } from "@/lib/suggest";
import { generateAllStandups } from "@/lib/standup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || "";
  return secret !== "" && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await refreshGithubData();
    let suggestions: { repo: string; count: number }[] = [];
    try {
      suggestions = await generateForTopProjects(3);
    } catch {
      /* suggestions are best-effort */
    }
    let standups = 0;
    try {
      const today = new Date().toISOString().slice(0, 10);
      standups = await generateAllStandups(today);
    } catch {
      /* standups are best-effort */
    }
    return Response.json({ ok: true, ...result, suggestions, standups });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
