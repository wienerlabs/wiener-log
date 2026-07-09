import {
  getProposedTasks,
  getQuietMembers,
  getProjectMomentum,
  upsertBriefing,
} from "@/lib/db";
import { getStalePulls, getUnassignedCritical } from "@/lib/digest";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function shortRepo(full: string): string {
  return full.split("/").pop() || full;
}

export async function gatherSignals() {
  const [stale, unassigned, proposed, quiet, momentum] = await Promise.all([
    getStalePulls(7, 10),
    getUnassignedCritical(10),
    getProposedTasks(12),
    getQuietMembers(3, 8),
    getProjectMomentum(12),
  ]);
  const cooling = momentum.filter((m) => m.prev >= 4 && m.cur < m.prev / 2);
  return { stale, unassigned, proposed, quiet, cooling };
}

type Signals = Awaited<ReturnType<typeof gatherSignals>>;

function fallbackSummary(s: Signals): string {
  const lines: string[] = [];
  if (s.unassigned.length)
    lines.push(
      `- ${s.unassigned.length} unassigned critical or high issue(s), starting with ${shortRepo(s.unassigned[0].repo)} #${s.unassigned[0].number}. Route them to an owner.`,
    );
  if (s.stale.length)
    lines.push(
      `- ${s.stale.length} pull request(s) open over a week; oldest is ${shortRepo(s.stale[0].repo)} #${s.stale[0].number} (${daysSince(s.stale[0].created_at)}d). Review or close.`,
    );
  if (s.proposed.length)
    lines.push(
      `- ${s.proposed.length} proposed task(s) awaiting your accept or reject.`,
    );
  if (s.cooling.length)
    lines.push(
      `- Momentum cooling on ${s.cooling.map((m) => m.name).slice(0, 3).join(", ")}. Check if these are blocked.`,
    );
  if (s.quiet.length)
    lines.push(
      `- Quiet this week: ${s.quiet.map((q) => q.handle).slice(0, 4).join(", ")}. Worth a check-in.`,
    );
  return lines.length ? lines.join("\n") : "- Nothing urgent across the portfolio right now.";
}

async function summarize(s: Signals): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackSummary(s);
  const ctx: string[] = [];
  if (s.stale.length) {
    ctx.push("Stale pull requests (open > 7 days):");
    for (const p of s.stale.slice(0, 8))
      ctx.push(
        `- ${shortRepo(p.repo)} #${p.number} "${p.title}" by ${p.author ?? "unknown"}, ${daysSince(p.created_at)}d old`,
      );
  }
  if (s.unassigned.length) {
    ctx.push("Unassigned critical/high issues:");
    for (const i of s.unassigned.slice(0, 8))
      ctx.push(`- [${i.priority}] ${shortRepo(i.repo)} #${i.number} "${i.title}"`);
  }
  if (s.proposed.length) {
    ctx.push(`Proposed tasks awaiting review (${s.proposed.length}):`);
    for (const t of s.proposed.slice(0, 6)) ctx.push(`- ${t.title}`);
  }
  if (s.cooling.length) {
    ctx.push("Projects losing momentum (events this week vs last):");
    for (const m of s.cooling)
      ctx.push(`- ${m.name}: ${m.cur} vs ${m.prev}`);
  }
  if (s.quiet.length) {
    ctx.push("Members quiet for 3+ days:");
    for (const q of s.quiet)
      ctx.push(
        `- ${q.handle}${q.last_event ? `, last active ${daysSince(q.last_event)}d ago` : ""}`,
      );
  }
  const prompt = `You are chief of staff to the founder of Wiener Labs, who runs many software projects at once. From the portfolio signals below, write the founder's attention list for today: 3 to 5 short, prioritized, action-oriented bullets. Name the specific project, PR, issue, or person. Lead with what is most urgent or most at risk. No preamble, no fluff. Return only the bullets, one per line starting with "- ".

Signals:
${ctx.join("\n")}`;
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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return fallbackSummary(s);
    const data = (await res.json()) as { content?: { text?: string }[] };
    return (data.content?.[0]?.text || "").trim() || fallbackSummary(s);
  } catch {
    return fallbackSummary(s);
  }
}

export async function generateBriefing(day: string): Promise<string> {
  const signals = await gatherSignals();
  const summary = (await summarize(signals)).replace(/[—–]/g, "-");
  await upsertBriefing(day, summary);
  return summary;
}
