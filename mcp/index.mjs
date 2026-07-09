#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { neon } from "@neondatabase/serverless";

const MCP_URL = process.env.WLOG_MCP_URL;
const MCP_TOKEN = process.env.WLOG_MCP_TOKEN;
const DB_URL = process.env.WLOG_DATABASE_URL;
let sql = null;
if (!MCP_URL && DB_URL) sql = neon(DB_URL);
if (!MCP_URL && !DB_URL) {
  console.error(
    "Set WLOG_MCP_URL (+ WLOG_MCP_TOKEN) for proxy mode, or WLOG_DATABASE_URL for direct mode",
  );
  process.exit(1);
}

const TOOLS = [
  {
    name: "list_repos",
    description:
      "List repositories across the wienerlabs and Sidewinder orgs. Optional org and text query.",
    inputSchema: {
      type: "object",
      properties: {
        org: { type: "string", description: "wienerlabs or S-SIDEWINDER" },
        query: { type: "string", description: "match name/description/topics" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "list_pull_requests",
    description: "List open pull requests, optionally filtered by repo full name.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name" },
        limit: { type: "number", default: 30 },
      },
    },
  },
  {
    name: "list_issues",
    description:
      "List open issues, optionally filtered by priority (critical/high/medium/low) or repo.",
    inputSchema: {
      type: "object",
      properties: {
        priority: { type: "string" },
        repo: { type: "string" },
        limit: { type: "number", default: 30 },
      },
    },
  },
  {
    name: "list_members",
    description: "List org members with their handles and orgs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "member_activity",
    description: "Recent git/Claude Code/GitHub activity for one member handle.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        limit: { type: "number", default: 20 },
      },
      required: ["handle"],
    },
  },
  {
    name: "list_tasks",
    description: "List synthesized/assigned tasks, optional status or member handle.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        handle: { type: "string" },
        limit: { type: "number", default: 40 },
      },
    },
  },
  {
    name: "project_health",
    description:
      "Per-repository health: open pull requests, open issues and last activity.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", default: 30 } },
    },
  },
  {
    name: "search",
    description: "Search repos, pull requests, issues and people by keyword.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "assign_task",
    description:
      "Assign an internal task to a member (writes to WienerLog, not GitHub).",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        repo: { type: "string" },
      },
      required: ["handle", "title"],
    },
  },
];

async function dispatch(name, a) {
  if (MCP_URL) {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${MCP_TOKEN || ""}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ tool: name, args: a }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "proxy error");
    return j.data;
  }
  const like = a.query ? `%${a.query}%` : null;
  switch (name) {
    case "list_repos":
      if (a.org && like)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE org=${a.org} AND NOT is_archived AND (name ILIKE ${like} OR description ILIKE ${like}) ORDER BY pushed_at DESC LIMIT ${a.limit || 20}`;
      if (a.org)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE org=${a.org} AND NOT is_archived ORDER BY pushed_at DESC LIMIT ${a.limit || 20}`;
      if (like)
        return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE NOT is_archived AND (name ILIKE ${like} OR description ILIKE ${like}) ORDER BY pushed_at DESC LIMIT ${a.limit || 20}`;
      return sql`SELECT full_name, language, stars, open_issues, is_private, pushed_at FROM gh_repos WHERE NOT is_archived ORDER BY pushed_at DESC LIMIT ${a.limit || 20}`;
    case "list_pull_requests":
      if (a.repo)
        return sql`SELECT repo, number, title, author, ci, created_at, html_url FROM gh_pulls WHERE repo=${a.repo} ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
      return sql`SELECT repo, number, title, author, ci, created_at, html_url FROM gh_pulls ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
    case "list_issues":
      if (a.priority && a.repo)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE priority=${a.priority} AND repo=${a.repo} ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
      if (a.priority)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE priority=${a.priority} ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
      if (a.repo)
        return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues WHERE repo=${a.repo} ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
      return sql`SELECT repo, number, title, priority, assignee, html_url FROM gh_issues ORDER BY created_at DESC LIMIT ${a.limit || 30}`;
    case "list_members":
      return sql`SELECT handle, array_agg(DISTINCT org ORDER BY org) AS orgs FROM member_orgs GROUP BY handle ORDER BY handle`;
    case "member_activity":
      return sql`SELECT e.source, e.kind, e.payload->>'repository' AS repository, e.payload->>'branch' AS branch, e.ingested_at FROM events e JOIN workspaces w ON w.id=e.workspace_id WHERE w.slug=${a.handle} ORDER BY e.ingested_at DESC LIMIT ${a.limit || 20}`;
    case "list_tasks":
      if (a.status && a.handle)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t JOIN users u ON u.id=t.owner_user_id JOIN workspaces w ON w.id=u.workspace_id WHERE t.status=${a.status} AND w.slug=${a.handle} ORDER BY t.created_at DESC LIMIT ${a.limit || 40}`;
      if (a.handle)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t JOIN users u ON u.id=t.owner_user_id JOIN workspaces w ON w.id=u.workspace_id WHERE w.slug=${a.handle} ORDER BY t.created_at DESC LIMIT ${a.limit || 40}`;
      if (a.status)
        return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t WHERE t.status=${a.status} ORDER BY t.created_at DESC LIMIT ${a.limit || 40}`;
      return sql`SELECT t.title, t.status, t.repo, t.created_at FROM tasks t ORDER BY t.created_at DESC LIMIT ${a.limit || 40}`;
    case "project_health":
      return sql`
        SELECT r.full_name, r.language, r.pushed_at,
          (SELECT count(*)::int FROM gh_pulls p WHERE p.repo=r.full_name) AS open_pulls,
          (SELECT count(*)::int FROM gh_issues i WHERE i.repo=r.full_name) AS open_issues
        FROM gh_repos r WHERE NOT r.is_archived AND NOT r.is_fork
        ORDER BY r.pushed_at DESC LIMIT ${a.limit || 30}`;
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
    case "assign_task": {
      const rows = await sql`SELECT u.id AS user_id, u.workspace_id FROM users u JOIN workspaces w ON w.id=u.workspace_id WHERE w.slug=${a.handle} LIMIT 1`;
      if (rows.length === 0) return { ok: false, error: "no workspace for member" };
      await sql`INSERT INTO tasks (workspace_id, node_type, title, body, repo, owner_user_id, status) VALUES (${rows[0].workspace_id}, 'intent', ${a.title}, ${a.body || null}, ${a.repo || null}, ${rows[0].user_id}, 'acked')`;
      return { ok: true };
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

const server = new Server(
  { name: "wienerlog", version: "1.0.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const data = await dispatch(name, args || {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: String(e?.message || e) }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("wienerlog-mcp ready");
