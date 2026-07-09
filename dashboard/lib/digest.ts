import { sql } from "@/lib/db";

export interface StalePull {
  repo: string;
  number: number;
  title: string;
  author: string | null;
  created_at: string;
  html_url: string;
}

export async function getStalePulls(days = 7, limit = 25): Promise<StalePull[]> {
  return (await sql`
    SELECT repo, number, title, author, created_at, html_url
    FROM gh_pulls
    WHERE draft = false AND created_at < now() - (${days} || ' days')::interval
    ORDER BY created_at ASC
    LIMIT ${limit}
  `) as StalePull[];
}

export interface UnassignedIssue {
  repo: string;
  number: number;
  title: string;
  priority: string;
  html_url: string;
  created_at: string;
}

export async function getUnassignedCritical(limit = 25): Promise<UnassignedIssue[]> {
  return (await sql`
    SELECT repo, number, title, priority, html_url, created_at
    FROM gh_issues
    WHERE assignee IS NULL AND priority IN ('critical', 'high')
    ORDER BY CASE priority WHEN 'critical' THEN 0 ELSE 1 END, created_at ASC
    LIMIT ${limit}
  `) as UnassignedIssue[];
}

export interface DigestData {
  events7d: number;
  stalePulls: StalePull[];
  unassigned: UnassignedIssue[];
  topRepos: { repo: string; events: number }[];
}

export async function getDigestData(): Promise<DigestData> {
  const [ev, stale, unassigned, top] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM events WHERE ingested_at >= now() - interval '7 days'`,
    getStalePulls(7, 25),
    getUnassignedCritical(25),
    sql`
      SELECT payload->>'repository' AS repo, count(*)::int AS events
      FROM events
      WHERE source = 'github' AND payload->>'repository' IS NOT NULL
        AND ingested_at >= now() - interval '7 days'
      GROUP BY 1 ORDER BY events DESC LIMIT 5`,
  ]);
  return {
    events7d: (ev as { n: number }[])[0]?.n ?? 0,
    stalePulls: stale,
    unassigned,
    topRepos: top as { repo: string; events: number }[],
  };
}

export function buildDigestMessage(d: DigestData): string {
  const lines: string[] = [];
  lines.push("<b>WienerLog weekly digest</b>");
  lines.push("");
  lines.push(`Activity: <b>${d.events7d}</b> events in the last 7 days`);
  if (d.topRepos.length) {
    lines.push(
      "Top repos: " +
        d.topRepos.map((r) => `${r.repo.split("/").pop()} (${r.events})`).join(", "),
    );
  }
  lines.push("");
  lines.push(`<b>Stale pull requests</b> (${d.stalePulls.length})`);
  for (const p of d.stalePulls.slice(0, 10)) {
    lines.push(`• ${p.repo.split("/").pop()} #${p.number} — ${p.title}`);
  }
  lines.push("");
  lines.push(`<b>Unassigned critical / high issues</b> (${d.unassigned.length})`);
  for (const i of d.unassigned.slice(0, 10)) {
    lines.push(`• [${i.priority}] ${i.repo.split("/").pop()} #${i.number} — ${i.title}`);
  }
  return lines.join("\n");
}
