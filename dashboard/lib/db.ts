import { neon } from "@neondatabase/serverless";

const url = process.env.WLOG_DATABASE_URL;
if (!url) {
  throw new Error("WLOG_DATABASE_URL is not set");
}

export const sql = neon(url);

export type TaskStatus =
  | "proposed"
  | "acked"
  | "in_progress"
  | "done"
  | "rejected";

export type EventSource = "git" | "claude_code" | "github";

export interface Overview {
  events_total: number;
  events_today: number;
  events_7d: number;
  tasks_total: number;
  members_total: number;
  workspaces_total: number;
  repos_total: number;
}

export async function getOverview(): Promise<Overview> {
  const rows = (await sql`
    SELECT
      (SELECT count(*) FROM events)                                          AS events_total,
      (SELECT count(*) FROM events WHERE ingested_at >= now() - interval '1 day')  AS events_today,
      (SELECT count(*) FROM events WHERE ingested_at >= now() - interval '7 days') AS events_7d,
      (SELECT count(*) FROM tasks)                                           AS tasks_total,
      (SELECT count(*) FROM users)                                           AS members_total,
      (SELECT count(*) FROM workspaces)                                      AS workspaces_total,
      (SELECT count(DISTINCT payload->>'repository') FROM events
         WHERE source = 'github' AND payload->>'repository' IS NOT NULL)     AS repos_total
  `) as Record<string, string>[];
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    events_total: n("events_total"),
    events_today: n("events_today"),
    events_7d: n("events_7d"),
    tasks_total: n("tasks_total"),
    members_total: n("members_total"),
    workspaces_total: n("workspaces_total"),
    repos_total: n("repos_total"),
  };
}

export interface StatusCount {
  status: TaskStatus;
  count: number;
}

export async function getTasksByStatus(): Promise<StatusCount[]> {
  const rows = (await sql`
    SELECT status, count(*)::int AS count
    FROM tasks GROUP BY status
  `) as { status: TaskStatus; count: number }[];
  const order: TaskStatus[] = [
    "proposed",
    "acked",
    "in_progress",
    "done",
    "rejected",
  ];
  const map = new Map(rows.map((r) => [r.status, r.count]));
  return order.map((status) => ({ status, count: map.get(status) ?? 0 }));
}

export interface DayPoint {
  day: string;
  git: number;
  github: number;
  claude_code: number;
  total: number;
}

export async function getEventsByDay(days = 14): Promise<DayPoint[]> {
  const rows = (await sql`
    SELECT
      to_char(date_trunc('day', ingested_at), 'YYYY-MM-DD') AS day,
      source,
      count(*)::int AS count
    FROM events
    WHERE ingested_at >= now() - (${days} || ' days')::interval
    GROUP BY 1, 2
    ORDER BY 1
  `) as { day: string; source: EventSource; count: number }[];

  const byDay = new Map<string, DayPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { day: key, git: 0, github: 0, claude_code: 0, total: 0 });
  }
  for (const r of rows) {
    const p = byDay.get(r.day);
    if (!p) continue;
    if (r.source === "git") p.git += r.count;
    else if (r.source === "github") p.github += r.count;
    else if (r.source === "claude_code") p.claude_code += r.count;
    p.total += r.count;
  }
  return [...byDay.values()];
}

export interface SourceCount {
  source: EventSource;
  count: number;
}

export async function getEventsBySource(): Promise<SourceCount[]> {
  return (await sql`
    SELECT source, count(*)::int AS count
    FROM events GROUP BY source ORDER BY count DESC
  `) as SourceCount[];
}

export interface EventRow {
  id: string;
  source: EventSource;
  kind: string;
  occurred_at: string;
  ingested_at: string;
  workspace_slug: string | null;
  label: string | null;
}

export async function getRecentEvents(
  limit = 40,
  opts: { source?: EventSource; workspace?: string } = {},
): Promise<EventRow[]> {
  if (opts.source && opts.workspace) {
    return (await sql`
      SELECT e.id, e.source, e.kind, e.occurred_at, e.ingested_at, w.slug AS workspace_slug,
        coalesce(e.payload->>'repository', e.payload->>'branch', e.payload->>'cwd') AS label
      FROM events e JOIN workspaces w ON w.id = e.workspace_id
      WHERE e.source = ${opts.source} AND w.slug = ${opts.workspace}
      ORDER BY e.ingested_at DESC LIMIT ${limit}
    `) as EventRow[];
  }
  if (opts.source) {
    return (await sql`
      SELECT e.id, e.source, e.kind, e.occurred_at, e.ingested_at, w.slug AS workspace_slug,
        coalesce(e.payload->>'repository', e.payload->>'branch', e.payload->>'cwd') AS label
      FROM events e JOIN workspaces w ON w.id = e.workspace_id
      WHERE e.source = ${opts.source}
      ORDER BY e.ingested_at DESC LIMIT ${limit}
    `) as EventRow[];
  }
  if (opts.workspace) {
    return (await sql`
      SELECT e.id, e.source, e.kind, e.occurred_at, e.ingested_at, w.slug AS workspace_slug,
        coalesce(e.payload->>'repository', e.payload->>'branch', e.payload->>'cwd') AS label
      FROM events e JOIN workspaces w ON w.id = e.workspace_id
      WHERE w.slug = ${opts.workspace}
      ORDER BY e.ingested_at DESC LIMIT ${limit}
    `) as EventRow[];
  }
  return (await sql`
    SELECT e.id, e.source, e.kind, e.occurred_at, e.ingested_at, w.slug AS workspace_slug,
      coalesce(e.payload->>'repository', e.payload->>'branch', e.payload->>'cwd') AS label
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    ORDER BY e.ingested_at DESC LIMIT ${limit}
  `) as EventRow[];
}

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  node_type: string;
  repo: string | null;
  workspace_slug: string;
  created_at: string;
}

export async function getTasks(
  opts: { status?: TaskStatus; workspace?: string; limit?: number } = {},
): Promise<TaskRow[]> {
  const limit = opts.limit ?? 200;
  if (opts.status && opts.workspace) {
    return (await sql`
      SELECT t.id, t.title, t.status, t.node_type::text AS node_type, t.repo,
             w.slug AS workspace_slug, t.created_at
      FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
      WHERE t.status = ${opts.status} AND w.slug = ${opts.workspace}
      ORDER BY t.created_at DESC LIMIT ${limit}
    `) as TaskRow[];
  }
  if (opts.status) {
    return (await sql`
      SELECT t.id, t.title, t.status, t.node_type::text AS node_type, t.repo,
             w.slug AS workspace_slug, t.created_at
      FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
      WHERE t.status = ${opts.status}
      ORDER BY t.created_at DESC LIMIT ${limit}
    `) as TaskRow[];
  }
  if (opts.workspace) {
    return (await sql`
      SELECT t.id, t.title, t.status, t.node_type::text AS node_type, t.repo,
             w.slug AS workspace_slug, t.created_at
      FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
      WHERE w.slug = ${opts.workspace}
      ORDER BY t.created_at DESC LIMIT ${limit}
    `) as TaskRow[];
  }
  return (await sql`
    SELECT t.id, t.title, t.status, t.node_type::text AS node_type, t.repo,
           w.slug AS workspace_slug, t.created_at
    FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
    ORDER BY t.created_at DESC LIMIT ${limit}
  `) as TaskRow[];
}

export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  members: number;
  tasks: number;
  events: number;
}

export async function getWorkspaces(): Promise<WorkspaceRow[]> {
  return (await sql`
    SELECT w.id, w.slug, w.name, w.created_at,
      (SELECT count(*)::int FROM users u WHERE u.workspace_id = w.id)  AS members,
      (SELECT count(*)::int FROM tasks t WHERE t.workspace_id = w.id)  AS tasks,
      (SELECT count(*)::int FROM events e WHERE e.workspace_id = w.id) AS events
    FROM workspaces w
    ORDER BY events DESC, w.slug ASC
  `) as WorkspaceRow[];
}

export async function getWorkspace(slug: string): Promise<WorkspaceRow | null> {
  const rows = (await sql`
    SELECT w.id, w.slug, w.name, w.created_at,
      (SELECT count(*)::int FROM users u WHERE u.workspace_id = w.id)  AS members,
      (SELECT count(*)::int FROM tasks t WHERE t.workspace_id = w.id)  AS tasks,
      (SELECT count(*)::int FROM events e WHERE e.workspace_id = w.id) AS events
    FROM workspaces w WHERE w.slug = ${slug}
  `) as WorkspaceRow[];
  return rows[0] ?? null;
}

export interface MemberRow {
  handle: string;
  email: string | null;
  workspace_slug: string;
  created_at: string;
  tasks: number;
}

export async function getMembers(): Promise<MemberRow[]> {
  return (await sql`
    SELECT u.handle, u.email, w.slug AS workspace_slug, u.created_at,
      (SELECT count(*)::int FROM tasks t WHERE t.owner_user_id = u.id) AS tasks
    FROM users u JOIN workspaces w ON w.id = u.workspace_id
    ORDER BY u.created_at DESC
  `) as MemberRow[];
}
