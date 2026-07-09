import {
  getRepoPulls,
  getRepoIssues,
  getProjectContributors,
  getMemberHandles,
  getTopActiveProjects,
  replaceSuggestions,
} from "@/lib/db";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";

function model(): string {
  return process.env.SUGGEST_MODEL || "claude-haiku-4-5";
}

async function callClaude(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch(ANTHROPIC, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.[0]?.text || "";
}

type Suggestion = { title: string; body: string; assignee: string | null };

function parseSuggestions(
  text: string,
  candidates: Map<string, string>,
): Suggestion[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as {
      title?: unknown;
      body?: unknown;
      assignee?: unknown;
    }[];
    return arr
      .filter((x) => x && x.title)
      .map((x) => {
        const raw = String(x.assignee || "").replace(/^@/, "").toLowerCase();
        return {
          title: String(x.title).slice(0, 140),
          body: String(x.body || "").slice(0, 400),
          assignee: candidates.get(raw) ?? null,
        };
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateForRepo(
  fullName: string,
  name: string,
): Promise<number> {
  const [pulls, issues, contributors, members] = await Promise.all([
    getRepoPulls(fullName),
    getRepoIssues(fullName),
    getProjectContributors(fullName),
    getMemberHandles(),
  ]);

  const memberSet = new Set(members.map((m) => m.toLowerCase()));
  const candidates = new Map<string, string>();
  for (const c of contributors) {
    if (memberSet.has(c.handle.toLowerCase())) {
      candidates.set(c.handle.toLowerCase(), c.handle);
    }
  }
  const candidateList =
    candidates.size > 0
      ? [...candidates.values()].join(", ")
      : "(no known team contributors)";

  const prTitles =
    pulls.slice(0, 10).map((p) => `- ${p.title}`).join("\n") || "(none)";
  const issueTitles =
    issues
      .slice(0, 12)
      .map((i) => `- [${i.priority}] ${i.title}`)
      .join("\n") || "(none)";

  const prompt = `You are a senior technical program manager at Wiener Labs.
Given a repository, its current open work, and the teammates who contribute to
it, propose exactly 3 concrete, high-leverage next tasks that are NOT already
covered by the open items below. For each task, also pick the single best
assignee from the contributor list based on who is most active on and familiar
with that area. Use their exact handle, or null if none clearly fits.

Repository: ${name}
Team contributors: ${candidateList}
Open pull requests:
${prTitles}
Open issues:
${issueTitles}

Return ONLY a JSON array, no prose:
[{"title":"...","body":"...","assignee":"handle-or-null"}, ...]`;

  const list = parseSuggestions(await callClaude(prompt), candidates);
  if (list.length) await replaceSuggestions(fullName, list);
  return list.length;
}

export async function generateForTopProjects(
  n = 3,
): Promise<{ repo: string; count: number }[]> {
  const top = await getTopActiveProjects(n);
  const out: { repo: string; count: number }[] = [];
  for (const p of top) {
    try {
      const count = await generateForRepo(p.full_name, p.name);
      out.push({ repo: p.full_name, count });
    } catch {
      out.push({ repo: p.full_name, count: 0 });
    }
  }
  return out;
}
