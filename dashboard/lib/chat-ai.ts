import { getGhStats, getTopActiveProjects } from "@/lib/db";
import { getUnassignedCritical } from "@/lib/digest";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";

export async function answerAsWiener(question: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "AI is not configured yet.";
  const [stats, top, crit] = await Promise.all([
    getGhStats(),
    getTopActiveProjects(5),
    getUnassignedCritical(8),
  ]);
  const context = `WienerLog snapshot:
- ${stats.repos} active repositories, ${stats.pulls} open pull requests, ${stats.issues} open issues, ${stats.members} members across ${stats.orgs} orgs.
- Most active projects: ${top.map((t) => t.name).join(", ") || "none"}.
- Unassigned critical/high issues: ${
    crit.map((c) => `${c.repo.split("/").pop()} #${c.number} ${c.title}`).join("; ") || "none"
  }.`;

  const prompt = `You are "WienerLog", a concise AI teammate inside Wiener Labs' internal team chat. Answer the teammate's question in 2-4 sentences, concretely, using ONLY the snapshot below. If the snapshot cannot answer it, say what you'd need. No preamble.

${context}

Question: ${question.replace(/@wiener/gi, "").trim()}`;

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
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return "I could not reach the model just now.";
    const data = (await res.json()) as { content?: { text?: string }[] };
    return (data.content?.[0]?.text || "No answer.").trim();
  } catch {
    return "I could not reach the model just now.";
  }
}
