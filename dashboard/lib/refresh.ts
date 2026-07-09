import { neon } from "@neondatabase/serverless";
import {
  listOrgRepos,
  listOpenPulls,
  listOpenIssues,
  getPull,
  getCommitStatus,
  pool,
} from "@/lib/github";

const sql = neon(process.env.WLOG_DATABASE_URL || "");
const ORGS = ["wienerlabs", "S-SIDEWINDER"];

type ApiUser = { login: string; avatar_url: string };
type ApiLabel = { name: string; color: string };
type ApiRepo = {
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  license: { spdx_id: string | null } | null;
  private: boolean;
  archived: boolean;
  fork: boolean;
  pushed_at: string;
  topics?: string[];
  html_url: string;
};
type ApiPull = {
  number: number;
  title: string;
  user: ApiUser | null;
  draft: boolean;
  labels: ApiLabel[];
  comments?: number;
  created_at: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  html_url: string;
};
type ApiIssue = {
  number: number;
  title: string;
  user: ApiUser | null;
  labels: ApiLabel[];
  comments: number;
  assignee: ApiUser | null;
  milestone: { title: string } | null;
  created_at: string;
  html_url: string;
  pull_request?: unknown;
};

function priorityOf(labels: ApiLabel[]): string {
  const names = labels.map((l) => l.name.toLowerCase());
  if (names.some((n) => n.includes("critical"))) return "critical";
  if (names.some((n) => n === "security" || n === "bug" || n.includes("high")))
    return "high";
  if (names.some((n) => n.includes("low") || n === "good first issue" || n === "wontfix"))
    return "low";
  return "medium";
}

export async function refreshGithubData(): Promise<{
  repos: number;
  pulls: number;
  issues: number;
}> {
  await sql`
    CREATE TABLE IF NOT EXISTS gh_repos (
      full_name text PRIMARY KEY, org text, name text, description text,
      language text, stars int, forks int, watchers int, open_issues int,
      license text, is_private bool, is_archived bool, is_fork bool,
      pushed_at timestamptz, topics text[], html_url text)`;
  await sql`
    CREATE TABLE IF NOT EXISTS gh_pulls (
      repo text, number int, title text, author text, author_avatar text,
      draft bool, labels jsonb, additions int, deletions int, comments int,
      ci text, created_at timestamptz, head_ref text, base_ref text,
      html_url text, PRIMARY KEY (repo, number))`;
  await sql`
    CREATE TABLE IF NOT EXISTS gh_issues (
      repo text, number int, title text, author text, author_avatar text,
      labels jsonb, comments int, assignee text, assignee_avatar text,
      milestone text, priority text, created_at timestamptz, html_url text,
      PRIMARY KEY (repo, number))`;

  const allRepos: { org: string; repo: ApiRepo }[] = [];
  for (const org of ORGS) {
    const repos = (await listOrgRepos(org)) as unknown as ApiRepo[];
    for (const r of repos) allRepos.push({ org, repo: r });
  }

  for (const { org, repo: r } of allRepos) {
    await sql`
      INSERT INTO gh_repos (full_name, org, name, description, language, stars,
        forks, watchers, open_issues, license, is_private, is_archived, is_fork,
        pushed_at, topics, html_url)
      VALUES (${r.full_name}, ${org}, ${r.name}, ${r.description}, ${r.language},
        ${r.stargazers_count}, ${r.forks_count}, ${r.watchers_count},
        ${r.open_issues_count}, ${r.license?.spdx_id || null}, ${r.private},
        ${r.archived}, ${r.fork}, ${r.pushed_at}, ${r.topics || []}, ${r.html_url})
      ON CONFLICT (full_name) DO UPDATE SET
        org = EXCLUDED.org, name = EXCLUDED.name, description = EXCLUDED.description,
        language = EXCLUDED.language, stars = EXCLUDED.stars, forks = EXCLUDED.forks,
        watchers = EXCLUDED.watchers, open_issues = EXCLUDED.open_issues,
        license = EXCLUDED.license, is_private = EXCLUDED.is_private,
        is_archived = EXCLUDED.is_archived, is_fork = EXCLUDED.is_fork,
        pushed_at = EXCLUDED.pushed_at, topics = EXCLUDED.topics,
        html_url = EXCLUDED.html_url`;
  }

  const active = allRepos.filter(({ repo }) => !repo.archived);
  let prBudget = 60;
  let pullTotal = 0;
  let issueTotal = 0;

  await pool(active, 8, async ({ repo: r }) => {
    const pulls = (await listOpenPulls(r.full_name)) as unknown as ApiPull[];
    await sql`DELETE FROM gh_pulls WHERE repo = ${r.full_name}`;
    for (const p of pulls) {
      let additions: number | null = null;
      let deletions: number | null = null;
      let ci: string | null = null;
      if (prBudget > 0) {
        prBudget--;
        try {
          const detail = (await getPull(r.full_name, p.number)) as unknown as {
            additions?: number;
            deletions?: number;
          };
          additions = detail.additions ?? null;
          deletions = detail.deletions ?? null;
          const st = await getCommitStatus(r.full_name, p.head.sha);
          ci =
            st.state === "success"
              ? "passing"
              : st.state === "pending"
                ? "pending"
                : st.total_count === 0
                  ? null
                  : "failing";
        } catch {
          /* leave nulls */
        }
      }
      await sql`
        INSERT INTO gh_pulls (repo, number, title, author, author_avatar, draft,
          labels, additions, deletions, comments, ci, created_at, head_ref,
          base_ref, html_url)
        VALUES (${r.full_name}, ${p.number}, ${p.title}, ${p.user?.login || null},
          ${p.user?.avatar_url || null}, ${p.draft},
          ${JSON.stringify((p.labels || []).map((l) => ({ name: l.name, color: l.color })))},
          ${additions}, ${deletions}, ${p.comments ?? 0}, ${ci}, ${p.created_at},
          ${p.head?.ref || null}, ${p.base?.ref || null}, ${p.html_url})
        ON CONFLICT (repo, number) DO NOTHING`;
      pullTotal++;
    }

    const issues = (
      (await listOpenIssues(r.full_name)) as unknown as ApiIssue[]
    ).filter((i) => !i.pull_request);
    await sql`DELETE FROM gh_issues WHERE repo = ${r.full_name}`;
    for (const i of issues) {
      await sql`
        INSERT INTO gh_issues (repo, number, title, author, author_avatar, labels,
          comments, assignee, assignee_avatar, milestone, priority, created_at, html_url)
        VALUES (${r.full_name}, ${i.number}, ${i.title}, ${i.user?.login || null},
          ${i.user?.avatar_url || null},
          ${JSON.stringify((i.labels || []).map((l) => ({ name: l.name, color: l.color })))},
          ${i.comments ?? 0}, ${i.assignee?.login || null},
          ${i.assignee?.avatar_url || null}, ${i.milestone?.title || null},
          ${priorityOf(i.labels || [])}, ${i.created_at}, ${i.html_url})
        ON CONFLICT (repo, number) DO NOTHING`;
      issueTotal++;
    }
  });

  return { repos: allRepos.length, pulls: pullTotal, issues: issueTotal };
}
