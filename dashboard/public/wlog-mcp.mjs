#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MCP_URL = process.env.WLOG_MCP_URL;
const MCP_TOKEN = process.env.WLOG_MCP_TOKEN || "";
if (!MCP_URL) {
  console.error("WLOG_MCP_URL is not set");
  process.exit(1);
}

const TOOLS = [
  {
    name: "list_repos",
    description: "List repositories across the wienerlabs and Sidewinder orgs.",
    inputSchema: {
      type: "object",
      properties: {
        org: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_pull_requests",
    description: "List open pull requests, optionally by repo (owner/name).",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "list_issues",
    description: "List open issues, optional priority or repo.",
    inputSchema: {
      type: "object",
      properties: {
        priority: { type: "string" },
        repo: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_members",
    description: "List org members and their orgs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "member_activity",
    description: "Recent activity for a member handle.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" }, limit: { type: "number" } },
      required: ["handle"],
    },
  },
  {
    name: "list_tasks",
    description: "List tasks, optional status or handle.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        handle: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "project_health",
    description: "Per-repo open pull requests, open issues, last activity.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "search",
    description: "Search repos, pull requests, issues and people.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
];

async function call(tool, args) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${MCP_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ tool, args }),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "proxy error");
  return j.data;
}

const server = new Server(
  { name: "wienerlog", version: "1.0.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const data = await call(req.params.name, req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: String(e?.message || e) }],
    };
  }
});

await server.connect(new StdioServerTransport());
console.error("wienerlog-mcp (proxy) ready");
