# WienerLog MCP server

Exposes the WienerLog Neon data (repos, pull requests, issues, members,
activity, tasks, project health, search, assign) to Claude Desktop and
Claude Code over stdio.

## Install

```
cd mcp && npm install
```

## Tools

- `list_repos` — repositories, optional org and text query
- `list_pull_requests` — open PRs, optional repo
- `list_issues` — open issues, optional priority or repo
- `list_members` — org members and their orgs
- `member_activity` — recent git / Claude Code / GitHub events for a handle
- `list_tasks` — synthesized/assigned tasks, optional status or handle
- `project_health` — per-repo open PRs, open issues, last activity
- `search` — repos, PRs, issues, people by keyword
- `assign_task` — assign an internal task to a member

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wienerlog": {
      "command": "node",
      "args": ["/Users/baturalpguvenc/wienerlog/mcp/index.mjs"],
      "env": { "WLOG_DATABASE_URL": "<your neon postgres url>" }
    }
  }
}
```

Restart Claude Desktop. Ask: "Which wienerlabs repo has the most open issues?"
or "Assign a task to mehmethayirli: review the auth flow."

## Claude Code

```
claude mcp add wienerlog --env WLOG_DATABASE_URL=<url> -- node /Users/baturalpguvenc/wienerlog/mcp/index.mjs
```

or add the same `mcpServers` block to a project `.mcp.json`.
