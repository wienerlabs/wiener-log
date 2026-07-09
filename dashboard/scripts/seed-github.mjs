import { neon } from "@neondatabase/serverless";
import { execFileSync } from "node:child_process";

const sql = neon(process.env.WLOG_DATABASE_URL);
const ORGS = ["wienerlabs", "S-SIDEWINDER"];

function gh(path) {
  try {
    const out = execFileSync("gh", ["api", path, "--paginate"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const merged = out.replace(/\]\s*\[/g, ",");
    return JSON.parse(merged);
  } catch {
    return [];
  }
}

function ghOne(path) {
  try {
    return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

await sql`
  CREATE TABLE IF NOT EXISTS gh_repos (
    full_name text PRIMARY KEY, org text, name text, description text,
    language text, stars int, forks int, watchers int, open_issues int,
    license text, is_private bool, is_archived bool, is_fork bool,
    pushed_at timestamptz, topics text[], html_url text
  )`;
await sql`
  CREATE TABLE IF NOT EXISTS gh_pulls (
    repo text, number int, title text, author text, author_avatar text,
    draft bool, labels jsonb, additions int, deletions int, comments int,
    ci text, created_at timestamptz, head_ref text, base_ref text,
    html_url text, PRIMARY KEY (repo, number)
  )`;
await sql`
  CREATE TABLE IF NOT EXISTS gh_issues (
    repo text, number int, title text, author text, author_avatar text,
    labels jsonb, comments int, assignee text, assignee_avatar text,
    milestone text, priority text, created_at timestamptz, html_url text,
    PRIMARY KEY (repo, number)
  )`;

await sql`TRUNCATE gh_repos`;
await sql`TRUNCATE gh_pulls`;
await sql`TRUNCATE gh_issues`;

function priorityOf(labels) {
  const names = labels.map((l) => l.name.toLowerCase());
  if (names.some((n) => n.includes("critical"))) return "critical";
  if (names.some((n) => n === "security" || n === "bug" || n.includes("high")))
    return "high";
  if (
    names.some(
      (n) => n.includes("low") || n === "good first issue" || n === "wontfix",
    )
  )
    return "low";
  return "medium";
}

let prBudget = 80;

for (const org of ORGS) {
  const repos = gh(`/orgs/${org}/repos?per_page=100&type=all`);
  for (const r of repos) {
    const topics = r.topics || [];
    await sql`
      INSERT INTO gh_repos (full_name, org, name, description, language, stars,
        forks, watchers, open_issues, license, is_private, is_archived, is_fork,
        pushed_at, topics, html_url)
      VALUES (${r.full_name}, ${org}, ${r.name}, ${r.description},
        ${r.language}, ${r.stargazers_count}, ${r.forks_count},
        ${r.watchers_count}, ${r.open_issues_count},
        ${r.license?.spdx_id || null}, ${r.private}, ${r.archived}, ${r.fork},
        ${r.pushed_at}, ${topics}, ${r.html_url})
      ON CONFLICT (full_name) DO NOTHING`;

    if (r.archived) continue;

    // Pull requests
    const pulls = gh(
      `/repos/${r.full_name}/pulls?state=open&per_page=50`,
    );
    for (const p of pulls) {
      let additions = null,
        deletions = null,
        ci = null;
      if (prBudget > 0) {
        prBudget--;
        const detail = ghOne(`/repos/${r.full_name}/pulls/${p.number}`);
        if (detail) {
          additions = detail.additions ?? null;
          deletions = detail.deletions ?? null;
        }
        const st = ghOne(
          `/repos/${r.full_name}/commits/${p.head.sha}/status`,
        );
        if (st) {
          ci =
            st.state === "success"
              ? "passing"
              : st.state === "pending"
                ? "pending"
                : st.total_count === 0
                  ? null
                  : "failing";
        }
      }
      await sql`
        INSERT INTO gh_pulls (repo, number, title, author, author_avatar,
          draft, labels, additions, deletions, comments, ci, created_at,
          head_ref, base_ref, html_url)
        VALUES (${r.full_name}, ${p.number}, ${p.title}, ${p.user?.login},
          ${p.user?.avatar_url}, ${p.draft},
          ${JSON.stringify((p.labels || []).map((l) => ({ name: l.name, color: l.color })))},
          ${additions}, ${deletions}, ${p.comments ?? 0}, ${ci},
          ${p.created_at}, ${p.head?.ref}, ${p.base?.ref}, ${p.html_url})
        ON CONFLICT (repo, number) DO NOTHING`;
    }

    // Issues (exclude PRs)
    const issues = gh(
      `/repos/${r.full_name}/issues?state=open&per_page=50`,
    ).filter((i) => !i.pull_request);
    for (const i of issues) {
      const labels = (i.labels || []).map((l) => ({
        name: l.name,
        color: l.color,
      }));
      await sql`
        INSERT INTO gh_issues (repo, number, title, author, author_avatar,
          labels, comments, assignee, assignee_avatar, milestone, priority,
          created_at, html_url)
        VALUES (${r.full_name}, ${i.number}, ${i.title}, ${i.user?.login},
          ${i.user?.avatar_url}, ${JSON.stringify(labels)}, ${i.comments ?? 0},
          ${i.assignee?.login || null}, ${i.assignee?.avatar_url || null},
          ${i.milestone?.title || null}, ${priorityOf(i.labels || [])},
          ${i.created_at}, ${i.html_url})
        ON CONFLICT (repo, number) DO NOTHING`;
    }
  }
  console.log(`${org}: ${repos.length} repos`);
}

const counts = await sql`
  SELECT (SELECT count(*)::int FROM gh_repos) AS repos,
         (SELECT count(*)::int FROM gh_pulls) AS pulls,
         (SELECT count(*)::int FROM gh_issues) AS issues`;
console.log(counts[0]);
