import { sql } from "@/lib/db";
import { findTokenOwner } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const bearer = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const shared = process.env.MCP_TOKEN || "";
  if (shared && bearer === shared) return true;
  return (await findTokenOwner(bearer, "mcp")) !== null;
}

type Args = Record<string, string | number | undefined>;

async function dispatch(name: string, a: Args): Promise<unknown> {
  const like = a.query ? `%${a.query}%` : null;
  const limit = Number(a.limit) || undefined;
  switch (name) {
    case "list_repos":
      if (a.org && like)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE org=${a.org} AND NOT is_archived AND (name ILIKE ${like} OR description ILIKE ${like}) ORDER BY pushed_at DESC LIMIT ${limit || 20}`;
      if (a.org)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE org=${a.org} AND NOT is_archived ORDER BY pushed_at DESC LIMIT ${limit || 20}`;
      if (like)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE NOT is_archived AND (name ILIKE ${like} OR description ILIKE ${like}) ORDER BY pushed_at DESC LIMIT ${limit || 20}`;
      return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE NOT is_archived ORDER BY pushed_at DESC LIMIT ${limit || 20}`;
    case "list_pull_requests":
      if (a.repo)
        return sql`SELECT repo, number, title, author, ci, created_at, html_url FROM gh_pulls WHERE repo=${a.repo} ORDER BY created_at DESC LIMIT ${limit || 30}`;
      return sql`SELECT repo, number, title, author, ci, created_at, html_url FROM gh_pulls ORDER BY created_at DESC LIMIT ${limit || 30}`;
    case "list_issues":
      if (a.priority && a.repo)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE priority=${a.priority} AND repo=${a.repo} ORDER BY created_at DESC LIMIT ${limit || 30}`;
      if (a.priority)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE priority=${a.priority} ORDER BY created_at DESC LIMIT ${limit || 30}`;
      if (a.repo)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE repo=${a.repo} ORDER BY created_at DESC LIMIT ${limit || 30}`;
      return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues ORDER BY created_at DESC LIMIT ${limit || 30}`;
    case "list_members":
      return sql`SELECT handle, array_agg(DISTINCT org ORDER BY org) AS orgs FROM member_orgs GROUP BY handle ORDER BY handle`;
    case "member_activity":
      return sql`SELECT e.source, e.kind, e.payload->>'repository' AS repository, e.payload->>'branch' AS branch, e.ingested_at FROM events e JOIN workspaces w ON w.id=e.workspace_id WHERE w.slug=${a.handle} ORDER BY e.ingested_at DESC LIMIT ${limit || 20}`;
    case "list_tasks":
      if (a.status && a.handle)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t JOIN users u ON u.id=t.owner_user_id JOIN workspaces w ON w.id=u.workspace_id WHERE t.status=${a.status} AND w.slug=${a.handle} ORDER BY t.created_at DESC LIMIT ${limit || 40}`;
      if (a.handle)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t JOIN users u ON u.id=t.owner_user_id JOIN workspaces w ON w.id=u.workspace_id WHERE w.slug=${a.handle} ORDER BY t.created_at DESC LIMIT ${limit || 40}`;
      if (a.status)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t WHERE t.status=${a.status} ORDER BY t.created_at DESC LIMIT ${limit || 40}`;
      return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t ORDER BY t.created_at DESC LIMIT ${limit || 40}`;
    case "project_health":
      return sql`SELECT r.full_name, r.language, r.pushed_at,
        (SELECT count(*)::int FROM gh_pulls p WHERE p.repo=r.full_name) AS open_pulls,
        (SELECT count(*)::int FROM gh_issues i WHERE i.repo=r.full_name) AS open_issues
        FROM gh_repos r WHERE NOT r.is_archived AND NOT r.is_fork
        ORDER BY r.pushed_at DESC LIMIT ${limit || 30}`;
    case "search": {
      const l = `%${a.query}%`;
      const [repos, pulls, issues, members] = await Promise.all([
        sql`SELECT full_name, html_url FROM gh_repos WHERE NOT is_archived AND (name ILIKE ${l} OR description ILIKE ${l}) LIMIT 6`,
        sql`SELECT repo, number, title, html_url FROM gh_pulls WHERE title ILIKE ${l} OR repo ILIKE ${l} LIMIT 6`,
        sql`SELECT repo, number, title, priority, html_url FROM gh_issues WHERE title ILIKE ${l} OR repo ILIKE ${l} LIMIT 6`,
        sql`SELECT DISTINCT handle FROM member_orgs WHERE handle ILIKE ${l} LIMIT 6`,
      ]);
      return { repos, pulls, issues, members };
    }
    default:
      throw new Error(`tool ${name} not available over the proxy`);
  }
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return new Response("Unauthorized", { status: 401 });
  let body: { tool?: string; args?: Args };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body.tool) return Response.json({ ok: false, error: "no tool" }, { status: 400 });
  try {
    const data = await dispatch(body.tool, body.args || {});
    return Response.json({ ok: true, data });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
