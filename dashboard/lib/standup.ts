import { sql, upsertStandup, getMemberHandles } from "@/lib/db";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";

type Ev = {
  kind: string;
  repo: string | null;
  message: string | null;
  branch: string | null;
};

async function summarize(events: Ev[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || events.length === 0) return null;
  const lines = events
    .slice(0, 60)
    .map(
      (e) =>
        `- ${e.kind}${e.repo ? " in " + e.repo.split("/").pop() : ""}${
          e.message ? ": " + e.message : e.branch ? " (" + e.branch + ")" : ""
        }`,
    )
    .join("\n");
  const prompt = `You are writing a teammate's async standup from their raw activity today. Summarize into 1-3 short, factual bullet points describing what they worked on. No fluff, no preamble. Return only the bullets, one per line starting with "- ".

Activity:
${lines}`;
  try {
    const res = await fetch(ANTHROPIC, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.SUGGEST_MODEL || "claude-haiku-4-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { text?: string }[] };
    return (data.content?.[0]?.text || "").trim() || null;
  } catch {
    return null;
  }
}

export async function generateStandup(
  handle: string,
  day: string,
): Promise<boolean> {
  const events = (await sql`
    SELECT e.kind, e.payload->>'repository' AS repo,
      e.payload->>'message' AS message, e.payload->>'branch' AS branch
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    WHERE w.slug = ${handle} AND e.source IN ('git', 'claude_code')
      AND e.ingested_at::date = ${day}
    ORDER BY e.ingested_at
  `) as Ev[];
  const summary = await summarize(events);
  if (summary) {
    await upsertStandup(handle, day, summary);
    return true;
  }
  return false;
}

export async function generateAllStandups(day: string): Promise<number> {
  const handles = await getMemberHandles();
  let n = 0;
  for (const h of handles) {
    try {
      if (await generateStandup(h, day)) n++;
    } catch {
      /* skip */
    }
  }
  return n;
}
