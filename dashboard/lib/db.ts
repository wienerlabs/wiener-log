import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | null = null;
function db(): SqlClient {
  if (!client) {
    const url = process.env.WLOG_DATABASE_URL;
    if (!url) throw new Error("WLOG_DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

export const sql = new Proxy((() => undefined) as unknown as SqlClient, {
  apply: (_t, _this, args: unknown[]) => (db() as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop: string | symbol) => (db() as unknown as Record<string | symbol, unknown>)[prop],
}) as SqlClient;

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
  github_url?: string | null;
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

export interface ProposedTask {
  id: string;
  title: string;
  body: string | null;
  repo: string | null;
  created_at: string;
  handle: string;
  avatar_url: string | null;
}

export async function getProposedTasks(limit = 12): Promise<ProposedTask[]> {
  return (await sql`
    SELECT t.id, t.title, t.body, t.repo, t.created_at,
      w.slug AS handle,
      (SELECT max(mo.avatar_url) FROM member_orgs mo
         WHERE lower(mo.handle) = lower(w.slug)) AS avatar_url
    FROM tasks t
    JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.status = 'proposed'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `) as ProposedTask[];
}

export async function setTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE tasks SET status = ${status}
    WHERE id = ${id} AND status = 'proposed' RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function setOwnTaskStatus(
  id: string,
  status: TaskStatus,
  handle: string,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE tasks SET status = ${status}
    WHERE id = ${id} AND status = 'proposed'
      AND workspace_id = (SELECT id FROM workspaces WHERE slug = ${handle})
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function adminSetTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE tasks SET status = ${status} WHERE id = ${id} RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function getProposedTasksFor(
  handle: string,
  limit = 8,
): Promise<ProposedTask[]> {
  return (await sql`
    SELECT t.id, t.title, t.body, t.repo, t.created_at,
      w.slug AS handle,
      (SELECT max(mo.avatar_url) FROM member_orgs mo
         WHERE lower(mo.handle) = lower(w.slug)) AS avatar_url
    FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.status = 'proposed' AND w.slug = ${handle}
    ORDER BY t.created_at DESC LIMIT ${limit}
  `) as ProposedTask[];
}

export async function getProjectByName(name: string): Promise<GhRepo | null> {
  const rows = (await sql`
    SELECT full_name, org, name, description, language, stars, forks, watchers,
      open_issues, license, is_private, is_archived, is_fork, pushed_at,
      coalesce(topics, '{}') AS topics, html_url
    FROM gh_repos WHERE name = ${name}
    ORDER BY is_archived ASC, is_fork ASC, pushed_at DESC LIMIT 1
  `) as GhRepo[];
  return rows[0] ?? null;
}

export async function getRepoPulls(repo: string): Promise<GhPull[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, draft, labels,
      additions, deletions, comments, ci, created_at, head_ref, base_ref, html_url
    FROM gh_pulls WHERE repo = ${repo} ORDER BY created_at DESC
  `) as GhPull[];
}

export async function getRepoIssues(repo: string): Promise<GhIssue[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, labels, comments,
      assignee, assignee_avatar, milestone, priority, created_at, html_url
    FROM gh_issues WHERE repo = ${repo}
    ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
      WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC
  `) as GhIssue[];
}

export async function getProjectContributors(
  repo: string,
): Promise<{ handle: string; avatar: string | null }[]> {
  return (await sql`
    SELECT handle, max(avatar) AS avatar FROM (
      SELECT author AS handle, author_avatar AS avatar FROM gh_pulls
        WHERE repo = ${repo} AND author IS NOT NULL
      UNION ALL SELECT author, author_avatar FROM gh_issues
        WHERE repo = ${repo} AND author IS NOT NULL
      UNION ALL SELECT assignee, assignee_avatar FROM gh_issues
        WHERE repo = ${repo} AND assignee IS NOT NULL
    ) x GROUP BY handle ORDER BY handle
  `) as { handle: string; avatar: string | null }[];
}

export interface ProjectTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  handle: string;
  github_url: string | null;
  created_at: string;
}

export async function getRepoTasks(repo: string): Promise<ProjectTaskRow[]> {
  return (await sql`
    SELECT t.id, t.title, t.status, w.slug AS handle, t.github_url, t.created_at
    FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.repo = ${repo} ORDER BY t.created_at DESC LIMIT 20
  `) as ProjectTaskRow[];
}

export async function getProjectActivity(
  repo: string,
  days = 84,
): Promise<HeatCell[]> {
  const rows = (await sql`
    SELECT to_char(date_trunc('day', ingested_at), 'YYYY-MM-DD') AS date,
      count(*)::int AS count
    FROM events
    WHERE source = 'github' AND payload->>'repository' = ${repo}
      AND ingested_at >= now() - (${days} || ' days')::interval
    GROUP BY 1
  `) as HeatCell[];
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: HeatCell[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export interface TopProject {
  full_name: string;
  name: string;
  org: string;
  language: string | null;
  pushed_at: string;
  recent_events: number;
}

export async function getTopActiveProjects(n = 3): Promise<TopProject[]> {
  return (await sql`
    SELECT r.full_name, r.name, r.org, r.language, r.pushed_at,
      coalesce((SELECT count(*)::int FROM events e
        WHERE e.source = 'github' AND e.payload->>'repository' = r.full_name
          AND e.ingested_at >= now() - interval '21 days'), 0) AS recent_events
    FROM gh_repos r WHERE NOT r.is_archived AND NOT r.is_fork
    ORDER BY recent_events DESC, r.pushed_at DESC
    LIMIT ${n}
  `) as TopProject[];
}

export interface ProjectSuggestion {
  id: number;
  repo: string;
  title: string;
  body: string | null;
  status: string;
  github_url: string | null;
  suggested_assignee: string | null;
  created_at: string;
}

export async function getProjectSuggestions(
  repo: string,
): Promise<ProjectSuggestion[]> {
  return (await sql`
    SELECT id, repo, title, body, status, github_url, suggested_assignee, created_at
    FROM project_suggestions WHERE repo = ${repo} AND status = 'open'
    ORDER BY created_at DESC
  `) as ProjectSuggestion[];
}

export async function getSuggestionById(
  id: number,
): Promise<ProjectSuggestion | null> {
  const rows = (await sql`
    SELECT id, repo, title, body, status, github_url, suggested_assignee, created_at
    FROM project_suggestions WHERE id = ${id} LIMIT 1
  `) as ProjectSuggestion[];
  return rows[0] ?? null;
}

export async function setSuggestionStatus(
  id: number,
  status: string,
  githubUrl?: string | null,
): Promise<{ repo: string; title: string; body: string | null } | null> {
  const rows = (await sql`
    UPDATE project_suggestions
    SET status = ${status}, github_url = ${githubUrl ?? null}
    WHERE id = ${id} AND status = 'open'
    RETURNING repo, title, body
  `) as { repo: string; title: string; body: string | null }[];
  return rows[0] ?? null;
}

export async function replaceSuggestions(
  repo: string,
  suggestions: { title: string; body: string; assignee?: string | null }[],
): Promise<void> {
  await sql`DELETE FROM project_suggestions WHERE repo = ${repo} AND status = 'open'`;
  for (const s of suggestions) {
    await sql`
      INSERT INTO project_suggestions (repo, title, body, suggested_assignee)
      VALUES (${repo}, ${s.title}, ${s.body}, ${s.assignee ?? null})`;
  }
}

export async function getMemberHandles(): Promise<string[]> {
  const rows = (await sql`
    SELECT DISTINCT handle FROM member_orgs
  `) as { handle: string }[];
  return rows.map((r) => r.handle);
}

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Message {
  id: number;
  author: string;
  avatar_url: string | null;
  body: string;
  kind: string;
  created_at: string;
  reactions: Reaction[];
}

export async function getRecentMessages(
  me: string,
  limit = 80,
): Promise<Message[]> {
  const rows = (await sql`
    SELECT * FROM (
      SELECT m.id, m.author, m.body, m.kind, m.created_at,
        (SELECT max(mo.avatar_url) FROM member_orgs mo
           WHERE lower(mo.handle) = lower(m.author)) AS avatar_url,
        coalesce((
          SELECT jsonb_agg(jsonb_build_object('emoji', e, 'count', c, 'mine', mine) ORDER BY firstat)
          FROM (
            SELECT emoji AS e, count(*)::int AS c, bool_or(handle = ${me}) AS mine, min(created_at) AS firstat
            FROM message_reactions WHERE message_id = m.id GROUP BY emoji
          ) rx
        ), '[]'::jsonb) AS reactions
      FROM messages m ORDER BY m.id DESC LIMIT ${limit}
    ) t ORDER BY t.id ASC
  `) as Message[];
  return rows;
}

export async function searchMessages(
  me: string,
  q: string,
  limit = 50,
): Promise<Message[]> {
  const like = `%${q.trim()}%`;
  const rows = (await sql`
    SELECT * FROM (
      SELECT m.id, m.author, m.body, m.kind, m.created_at,
        (SELECT max(mo.avatar_url) FROM member_orgs mo
           WHERE lower(mo.handle) = lower(m.author)) AS avatar_url,
        coalesce((
          SELECT jsonb_agg(jsonb_build_object('emoji', e, 'count', c, 'mine', mine) ORDER BY firstat)
          FROM (
            SELECT emoji AS e, count(*)::int AS c, bool_or(handle = ${me}) AS mine, min(created_at) AS firstat
            FROM message_reactions WHERE message_id = m.id GROUP BY emoji
          ) rx
        ), '[]'::jsonb) AS reactions
      FROM messages m WHERE m.body ILIKE ${like} ORDER BY m.id DESC LIMIT ${limit}
    ) t ORDER BY t.id ASC
  `) as Message[];
  return rows;
}

export async function postMessage(
  author: string,
  body: string,
  kind = "user",
): Promise<Message | null> {
  const b = body.trim();
  if (!b || b.length > 4000) return null;
  const rows = (await sql`
    INSERT INTO messages (author, body, kind) VALUES (${author}, ${b}, ${kind})
    RETURNING id, author, body, kind, created_at
  `) as Omit<Message, "avatar_url" | "reactions">[];
  return rows[0]
    ? { ...rows[0], avatar_url: null, reactions: [] }
    : null;
}

export async function toggleReaction(
  messageId: number,
  handle: string,
  emoji: string,
): Promise<void> {
  const existing = (await sql`
    SELECT 1 FROM message_reactions
    WHERE message_id = ${messageId} AND handle = ${handle} AND emoji = ${emoji}
  `) as unknown[];
  if (existing.length) {
    await sql`DELETE FROM message_reactions
      WHERE message_id = ${messageId} AND handle = ${handle} AND emoji = ${emoji}`;
  } else {
    await sql`INSERT INTO message_reactions (message_id, handle, emoji)
      VALUES (${messageId}, ${handle}, ${emoji})
      ON CONFLICT DO NOTHING`;
  }
}

export async function getProjectNames(): Promise<string[]> {
  const rows = (await sql`
    SELECT name FROM gh_repos WHERE NOT is_archived AND NOT is_fork
    ORDER BY pushed_at DESC LIMIT 200
  `) as { name: string }[];
  return rows.map((r) => r.name);
}

export interface Notification {
  id: number;
  recipient: string;
  actor: string | null;
  kind: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export async function createNotification(input: {
  recipient: string;
  actor?: string | null;
  kind: string;
  body?: string | null;
  link?: string | null;
  messageId?: number | null;
}): Promise<void> {
  await sql`
    INSERT INTO notifications (recipient, actor, kind, body, link, message_id)
    VALUES (${input.recipient}, ${input.actor ?? null}, ${input.kind},
            ${input.body ?? null}, ${input.link ?? null}, ${input.messageId ?? null})`;
}

export async function getNotifications(
  recipient: string,
  limit = 30,
): Promise<Notification[]> {
  return (await sql`
    SELECT id, recipient, actor, kind, body, link, read, created_at
    FROM notifications WHERE recipient = ${recipient}
    ORDER BY id DESC LIMIT ${limit}
  `) as Notification[];
}

export async function unreadCount(recipient: string): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS n FROM notifications
    WHERE recipient = ${recipient} AND read = false
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function markNotificationsRead(recipient: string): Promise<void> {
  await sql`UPDATE notifications SET read = true
    WHERE recipient = ${recipient} AND read = false`;
}

export interface Invite {
  token: string;
  handle: string | null;
  role: string;
  accepted: boolean;
}

export async function createInvite(
  token: string,
  handle: string,
  invitedBy: string,
  role = "employee",
): Promise<void> {
  await sql`
    INSERT INTO invitations (token, handle, role, invited_by)
    VALUES (${token}, ${handle}, ${role}, ${invitedBy})`;
}

export async function getInvite(token: string): Promise<Invite | null> {
  const rows = (await sql`
    SELECT token, handle, role, accepted FROM invitations WHERE token = ${token}
  `) as Invite[];
  return rows[0] ?? null;
}

export async function markInviteAccepted(token: string): Promise<void> {
  await sql`UPDATE invitations SET accepted = true WHERE token = ${token}`;
}

export async function createAccount(
  username: string,
  passwordHash: string,
  role: string,
  handle: string | null,
): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO accounts (username, password_hash, role, handle, display_name)
    VALUES (lower(${username}), ${passwordHash}, ${role}, ${handle}, ${username})
    ON CONFLICT (username) DO NOTHING RETURNING username
  `) as { username: string }[];
  return rows.length > 0;
}

export interface Document {
  id: number;
  title: string;
  body: string;
  author: string;
  scope: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export async function createDocument(
  author: string,
  scope: string,
  title: string,
): Promise<number> {
  const rows = (await sql`
    INSERT INTO documents (title, body, author, scope, updated_by)
    VALUES (${title || "Untitled"}, '', ${author}, ${scope}, ${author})
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function getDocument(id: number): Promise<Document | null> {
  const rows = (await sql`
    SELECT id, title, body, author, scope, created_at, updated_at, updated_by
    FROM documents WHERE id = ${id}
  `) as Document[];
  return rows[0] ?? null;
}

export async function updateDocument(
  id: number,
  title: string,
  body: string,
  updatedBy: string,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE documents SET title = ${title}, body = ${body},
      updated_by = ${updatedBy}, updated_at = now()
    WHERE id = ${id} RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

export async function deleteDocument(id: number): Promise<boolean> {
  const rows = (await sql`
    DELETE FROM documents WHERE id = ${id} RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

export interface DocSummary {
  id: number;
  title: string;
  author: string;
  updated_at: string;
  updated_by: string | null;
}

export async function listVaultDocs(): Promise<DocSummary[]> {
  return (await sql`
    SELECT id, title, author, updated_at, updated_by FROM documents
    WHERE scope = 'vault' ORDER BY updated_at DESC LIMIT 200
  `) as DocSummary[];
}

export async function listPersonalDocs(handle: string): Promise<DocSummary[]> {
  return (await sql`
    SELECT id, title, author, updated_at, updated_by FROM documents
    WHERE scope = 'personal' AND author = ${handle}
    ORDER BY updated_at DESC LIMIT 100
  `) as DocSummary[];
}

export interface Meeting {
  room: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
}

export async function createMeeting(
  room: string,
  title: string,
  createdBy: string,
): Promise<void> {
  await sql`
    INSERT INTO meetings (room, title, created_by)
    VALUES (${room}, ${title || null}, ${createdBy})
    ON CONFLICT (room) DO NOTHING`;
}

export async function getMeeting(room: string): Promise<Meeting | null> {
  const rows = (await sql`
    SELECT room, title, created_by, created_at FROM meetings WHERE room = ${room}
  `) as Meeting[];
  return rows[0] ?? null;
}

export async function meetPing(room: string, handle: string): Promise<void> {
  await sql`
    INSERT INTO meeting_participants (room, handle, last_seen)
    VALUES (${room}, ${handle}, now())
    ON CONFLICT (room, handle) DO UPDATE SET last_seen = now()`;
}

export async function meetLeave(room: string, handle: string): Promise<void> {
  await sql`DELETE FROM meeting_participants WHERE room = ${room} AND handle = ${handle}`;
}

export interface ActiveMeeting {
  room: string;
  title: string | null;
  created_by: string | null;
  participants: string[];
}

export async function listActiveMeetings(): Promise<ActiveMeeting[]> {
  return (await sql`
    SELECT m.room, m.title, m.created_by,
      coalesce((
        SELECT jsonb_agg(p.handle) FROM meeting_participants p
        WHERE p.room = m.room AND p.last_seen > now() - interval '60 seconds'
      ), '[]'::jsonb) AS participants
    FROM meetings m
    WHERE EXISTS (
      SELECT 1 FROM meeting_participants p
      WHERE p.room = m.room AND p.last_seen > now() - interval '60 seconds'
    )
    ORDER BY m.created_at DESC LIMIT 10
  `) as ActiveMeeting[];
}

export async function upsertStandup(
  handle: string,
  day: string,
  summary: string,
): Promise<void> {
  await sql`
    INSERT INTO standups (handle, day, summary) VALUES (${handle}, ${day}, ${summary})
    ON CONFLICT (handle, day) DO UPDATE SET summary = EXCLUDED.summary, created_at = now()`;
}

export interface StandupRow {
  handle: string;
  avatar_url: string | null;
  summary: string;
}

export async function getStandups(day: string): Promise<StandupRow[]> {
  return (await sql`
    SELECT s.handle, s.summary,
      (SELECT max(mo.avatar_url) FROM member_orgs mo WHERE lower(mo.handle) = lower(s.handle)) AS avatar_url
    FROM standups s WHERE s.day = ${day} ORDER BY s.handle
  `) as StandupRow[];
}

export async function getMemberStandup(
  handle: string,
  day: string,
): Promise<string | null> {
  const rows = (await sql`
    SELECT summary FROM standups WHERE handle = ${handle} AND day = ${day}
  `) as { summary: string }[];
  return rows[0]?.summary ?? null;
}

export async function setUserStatus(
  handle: string,
  status: string,
  message: string | null,
  until: string | null,
): Promise<void> {
  await sql`
    INSERT INTO user_status (handle, status, message, until, updated_at)
    VALUES (${handle}, ${status}, ${message}, ${until}, now())
    ON CONFLICT (handle) DO UPDATE SET status = EXCLUDED.status,
      message = EXCLUDED.message, until = EXCLUDED.until, updated_at = now()`;
}

export async function getUserStatus(
  handle: string,
): Promise<{ status: string; message: string | null } | null> {
  const rows = (await sql`
    SELECT status, message FROM user_status WHERE handle = ${handle}
  `) as { status: string; message: string | null }[];
  return rows[0] ?? null;
}

export interface PresenceRow {
  handle: string;
  avatar_url: string | null;
  last_seen: string | null;
  in_call: number;
  status: string | null;
  message: string | null;
  until: string | null;
}

export async function getTeamPresence(): Promise<PresenceRow[]> {
  return (await sql`
    SELECT mo.handle, max(mo.avatar_url) AS avatar_url,
      (SELECT max(s.last_seen_at) FROM auth_sessions s
         WHERE s.handle = mo.handle AND s.logout_at IS NULL) AS last_seen,
      (SELECT count(*)::int FROM meeting_participants mp
         WHERE mp.handle = mo.handle AND mp.last_seen > now() - interval '60 seconds') AS in_call,
      max(us.status) AS status, max(us.message) AS message, max(us.until) AS until
    FROM member_orgs mo
    LEFT JOIN user_status us ON us.handle = mo.handle
    GROUP BY mo.handle ORDER BY mo.handle
  `) as PresenceRow[];
}

export interface Announcement {
  id: number;
  author: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
}

export async function createAnnouncement(
  author: string,
  title: string,
  body: string,
  pinned: boolean,
): Promise<number> {
  const rows = (await sql`
    INSERT INTO announcements (author, title, body, pinned)
    VALUES (${author}, ${title}, ${body || null}, ${pinned}) RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function listAnnouncements(limit = 30): Promise<Announcement[]> {
  return (await sql`
    SELECT id, author, title, body, pinned, created_at FROM announcements
    ORDER BY pinned DESC, id DESC LIMIT ${limit}
  `) as Announcement[];
}

export async function getLatestPinned(): Promise<Announcement | null> {
  const rows = (await sql`
    SELECT id, author, title, body, pinned, created_at FROM announcements
    WHERE pinned = true ORDER BY id DESC LIMIT 1
  `) as Announcement[];
  return rows[0] ?? null;
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  const rows = (await sql`DELETE FROM announcements WHERE id = ${id} RETURNING id`) as {
    id: number;
  }[];
  return rows.length > 0;
}

export interface KeyResult {
  id: number;
  title: string;
  progress: number;
}
export interface Objective {
  id: number;
  title: string;
  owner: string | null;
  period: string | null;
  key_results: KeyResult[];
}

export async function createObjective(
  title: string,
  owner: string,
  period: string,
  createdBy: string,
): Promise<number> {
  const rows = (await sql`
    INSERT INTO objectives (title, owner, period, created_by)
    VALUES (${title}, ${owner || null}, ${period || null}, ${createdBy}) RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function listObjectives(): Promise<Objective[]> {
  return (await sql`
    SELECT o.id, o.title, o.owner, o.period,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'progress', k.progress) ORDER BY k.id)
        FROM key_results k WHERE k.objective_id = o.id
      ), '[]'::jsonb) AS key_results
    FROM objectives o ORDER BY o.id DESC
  `) as Objective[];
}

export async function addKeyResult(
  objectiveId: number,
  title: string,
): Promise<void> {
  await sql`INSERT INTO key_results (objective_id, title) VALUES (${objectiveId}, ${title})`;
}

export async function updateKeyResultProgress(
  id: number,
  progress: number,
): Promise<void> {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  await sql`UPDATE key_results SET progress = ${p} WHERE id = ${id}`;
}

export async function deleteObjective(id: number): Promise<void> {
  await sql`DELETE FROM key_results WHERE objective_id = ${id}`;
  await sql`DELETE FROM objectives WHERE id = ${id}`;
}

export interface MentionRow {
  id: number;
  actor: string | null;
  body: string | null;
  link: string | null;
  created_at: string;
}
export async function getUnreadMentions(
  handle: string,
  limit = 8,
): Promise<MentionRow[]> {
  return (await sql`
    SELECT id, actor, body, link, created_at
    FROM notifications
    WHERE recipient = ${handle} AND kind = 'mention' AND read = false
    ORDER BY created_at DESC LIMIT ${limit}
  `) as MentionRow[];
}

export interface QuietMember {
  handle: string;
  avatar: string | null;
  last_event: string | null;
}
export async function getQuietMembers(
  days = 3,
  limit = 8,
): Promise<QuietMember[]> {
  const rows = (await sql`
    SELECT mo.handle, max(mo.avatar_url) AS avatar,
      (SELECT max(e.ingested_at) FROM events e
        JOIN workspaces w ON w.id = e.workspace_id
        WHERE w.slug = mo.handle) AS last_event
    FROM member_orgs mo GROUP BY mo.handle
  `) as QuietMember[];
  const cutoff = Date.now() - days * 86400000;
  return rows
    .filter((r) => r.last_event && new Date(r.last_event).getTime() < cutoff)
    .sort(
      (a, b) =>
        new Date(a.last_event as string).getTime() -
        new Date(b.last_event as string).getTime(),
    )
    .slice(0, limit);
}

export interface MomentumRepo {
  repo: string;
  name: string;
  language: string | null;
  cur: number;
  prev: number;
}
export async function getProjectMomentum(limit = 8): Promise<MomentumRepo[]> {
  return (await sql`
    SELECT r.full_name AS repo, r.name, r.language,
      coalesce((SELECT count(*)::int FROM events e
        WHERE e.payload->>'repository' = r.full_name
          AND e.ingested_at >= now() - interval '7 days'), 0) AS cur,
      coalesce((SELECT count(*)::int FROM events e
        WHERE e.payload->>'repository' = r.full_name
          AND e.ingested_at >= now() - interval '14 days'
          AND e.ingested_at < now() - interval '7 days'), 0) AS prev
    FROM gh_repos r WHERE NOT r.is_archived AND NOT r.is_fork
    ORDER BY cur DESC, prev DESC LIMIT ${limit}
  `) as MomentumRepo[];
}

export async function getBriefing(
  day: string,
): Promise<{ summary: string; created_at: string } | null> {
  const rows = (await sql`
    SELECT summary, created_at FROM briefings WHERE day = ${day} LIMIT 1
  `) as { summary: string; created_at: string }[];
  return rows[0] ?? null;
}
export async function upsertBriefing(
  day: string,
  summary: string,
): Promise<void> {
  await sql`
    INSERT INTO briefings (day, summary) VALUES (${day}, ${summary})
    ON CONFLICT (day) DO UPDATE SET summary = EXCLUDED.summary, created_at = now()
  `;
}

export interface Contributor {
  handle: string;
  avatar: string | null;
  contributions: number;
  share: number;
}
export interface OwnershipRepo {
  repo: string;
  name: string;
  language: string | null;
  is_private: boolean;
  total: number;
  count: number;
  primary: string;
  contributors: Contributor[];
}
export async function getRepoOwnership(): Promise<OwnershipRepo[]> {
  const own = (await sql`
    SELECT c.repo, c.handle, max(mo.avatar_url) AS avatar, count(*)::int AS contributions
    FROM (
      SELECT repo, author AS handle FROM gh_pulls WHERE author IS NOT NULL
      UNION ALL SELECT repo, author AS handle FROM gh_issues WHERE author IS NOT NULL
      UNION ALL SELECT repo, assignee AS handle FROM gh_issues WHERE assignee IS NOT NULL
      UNION ALL SELECT e.payload->>'repository' AS repo, w.slug AS handle
        FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE e.payload->>'repository' IS NOT NULL
    ) c
    JOIN member_orgs mo ON mo.handle = c.handle
    WHERE c.repo IS NOT NULL
    GROUP BY c.repo, c.handle
  `) as {
    repo: string;
    handle: string;
    avatar: string | null;
    contributions: number;
  }[];
  const meta = (await sql`
    SELECT full_name, name, language, is_private
    FROM gh_repos WHERE NOT is_archived AND NOT is_fork
  `) as {
    full_name: string;
    name: string;
    language: string | null;
    is_private: boolean;
  }[];
  const metaMap = new Map(meta.map((m) => [m.full_name, m]));
  const byRepo = new Map<string, typeof own>();
  for (const r of own) {
    if (!metaMap.has(r.repo)) continue;
    const arr = byRepo.get(r.repo) ?? [];
    arr.push(r);
    byRepo.set(r.repo, arr);
  }
  const out: OwnershipRepo[] = [];
  for (const [repo, rows] of byRepo) {
    const m = metaMap.get(repo) as (typeof meta)[number];
    const total = rows.reduce((a, r) => a + r.contributions, 0);
    const contributors = rows
      .map((r) => ({
        handle: r.handle,
        avatar: r.avatar,
        contributions: r.contributions,
        share: total > 0 ? r.contributions / total : 0,
      }))
      .sort((a, b) => b.contributions - a.contributions);
    out.push({
      repo,
      name: m.name,
      language: m.language,
      is_private: m.is_private,
      total,
      count: contributors.length,
      primary: contributors[0]?.handle ?? "",
      contributors,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export interface ExpertiseRepo {
  repo: string;
  name: string;
  language: string | null;
  contributions: number;
}
export async function getMemberExpertise(
  handle: string,
): Promise<{ repos: ExpertiseRepo[]; languages: { language: string; count: number }[] }> {
  const repos = (await sql`
    SELECT c.repo, r.name, r.language, count(*)::int AS contributions
    FROM (
      SELECT repo, author AS handle FROM gh_pulls WHERE author IS NOT NULL
      UNION ALL SELECT repo, author AS handle FROM gh_issues WHERE author IS NOT NULL
      UNION ALL SELECT repo, assignee AS handle FROM gh_issues WHERE assignee IS NOT NULL
      UNION ALL SELECT e.payload->>'repository' AS repo, w.slug AS handle
        FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE e.payload->>'repository' IS NOT NULL
    ) c
    JOIN gh_repos r ON r.full_name = c.repo AND NOT r.is_archived AND NOT r.is_fork
    WHERE c.handle = ${handle}
    GROUP BY c.repo, r.name, r.language
    ORDER BY contributions DESC LIMIT 10
  `) as ExpertiseRepo[];
  const langMap = new Map<string, number>();
  for (const r of repos) {
    if (!r.language) continue;
    langMap.set(r.language, (langMap.get(r.language) ?? 0) + r.contributions);
  }
  const languages = [...langMap.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
  return { repos, languages };
}

export async function getRepoReviewers(
  repo: string,
  limit = 5,
): Promise<Contributor[]> {
  const rows = (await sql`
    SELECT c.handle, max(mo.avatar_url) AS avatar, count(*)::int AS contributions
    FROM (
      SELECT repo, author AS handle FROM gh_pulls WHERE author IS NOT NULL
      UNION ALL SELECT repo, author AS handle FROM gh_issues WHERE author IS NOT NULL
      UNION ALL SELECT repo, assignee AS handle FROM gh_issues WHERE assignee IS NOT NULL
      UNION ALL SELECT e.payload->>'repository' AS repo, w.slug AS handle
        FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE e.payload->>'repository' IS NOT NULL
    ) c
    JOIN member_orgs mo ON mo.handle = c.handle
    WHERE c.repo = ${repo}
    GROUP BY c.handle ORDER BY contributions DESC LIMIT ${limit}
  `) as { handle: string; avatar: string | null; contributions: number }[];
  const total = rows.reduce((a, r) => a + r.contributions, 0);
  return rows.map((r) => ({
    handle: r.handle,
    avatar: r.avatar,
    contributions: r.contributions,
    share: total > 0 ? r.contributions / total : 0,
  }));
}

export async function getMemberHeatmap(
  workspace: string,
  weeks = 26,
): Promise<HeatCell[]> {
  const days = weeks * 7;
  const rows = (await sql`
    SELECT to_char(date_trunc('day', e.ingested_at), 'YYYY-MM-DD') AS date,
      count(*)::int AS count
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    WHERE w.slug = ${workspace}
      AND e.ingested_at >= now() - (${days} || ' days')::interval
    GROUP BY 1
  `) as HeatCell[];
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: HeatCell[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
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
  avatar_url: string | null;
  orgs: string[];
  email: string | null;
  tasks: number;
  events: number;
  created_at: string | null;
}

export async function getMembers(org?: string): Promise<MemberRow[]> {
  const rows = org
    ? ((await sql`
        SELECT mo.handle,
          max(mo.avatar_url) AS avatar_url,
          array_agg(DISTINCT allo.org ORDER BY allo.org) AS orgs,
          (SELECT u.email FROM users u JOIN workspaces w ON w.id = u.workspace_id
             WHERE w.slug = mo.handle LIMIT 1) AS email,
          (SELECT count(*)::int FROM tasks t JOIN users u ON u.id = t.owner_user_id
             JOIN workspaces w ON w.id = u.workspace_id WHERE w.slug = mo.handle) AS tasks,
          (SELECT count(*)::int FROM events e JOIN workspaces w ON w.id = e.workspace_id
             WHERE w.slug = mo.handle) AS events,
          (SELECT min(u.created_at) FROM users u JOIN workspaces w ON w.id = u.workspace_id
             WHERE w.slug = mo.handle) AS created_at
        FROM member_orgs mo
        JOIN member_orgs allo ON allo.handle = mo.handle
        WHERE mo.org = ${org}
        GROUP BY mo.handle
        ORDER BY events DESC, mo.handle ASC
      `) as MemberRow[])
    : ((await sql`
        SELECT mo.handle,
          max(mo.avatar_url) AS avatar_url,
          array_agg(DISTINCT mo.org ORDER BY mo.org) AS orgs,
          (SELECT u.email FROM users u JOIN workspaces w ON w.id = u.workspace_id
             WHERE w.slug = mo.handle LIMIT 1) AS email,
          (SELECT count(*)::int FROM tasks t JOIN users u ON u.id = t.owner_user_id
             JOIN workspaces w ON w.id = u.workspace_id WHERE w.slug = mo.handle) AS tasks,
          (SELECT count(*)::int FROM events e JOIN workspaces w ON w.id = e.workspace_id
             WHERE w.slug = mo.handle) AS events,
          (SELECT min(u.created_at) FROM users u JOIN workspaces w ON w.id = u.workspace_id
             WHERE w.slug = mo.handle) AS created_at
        FROM member_orgs mo
        GROUP BY mo.handle
        ORDER BY events DESC, mo.handle ASC
      `) as MemberRow[]);
  return rows;
}

export interface OrgRow {
  org: string;
  members: number;
}

export async function getOrgs(): Promise<OrgRow[]> {
  return (await sql`
    SELECT org, count(*)::int AS members
    FROM member_orgs GROUP BY org ORDER BY members DESC
  `) as OrgRow[];
}

export interface MemberDetail {
  handle: string;
  avatar_url: string | null;
  orgs: string[];
  email: string | null;
  workspace_slug: string | null;
  workspace_id: string | null;
  user_id: string | null;
  tasks: number;
  events: number;
  created_at: string | null;
}

export async function getMember(handle: string): Promise<MemberDetail | null> {
  const rows = (await sql`
    SELECT mo.handle,
      max(mo.avatar_url) AS avatar_url,
      array_agg(DISTINCT mo.org ORDER BY mo.org) AS orgs
    FROM member_orgs mo WHERE mo.handle = ${handle} GROUP BY mo.handle
  `) as { handle: string; avatar_url: string | null; orgs: string[] }[];
  if (rows.length === 0) return null;
  const base = rows[0];

  const u = (await sql`
    SELECT u.id AS user_id, u.email, w.id AS workspace_id, w.slug AS workspace_slug,
      u.created_at,
      (SELECT count(*)::int FROM tasks t WHERE t.owner_user_id = u.id) AS tasks,
      (SELECT count(*)::int FROM events e WHERE e.workspace_id = w.id) AS events
    FROM users u JOIN workspaces w ON w.id = u.workspace_id
    WHERE w.slug = ${handle} LIMIT 1
  `) as {
    user_id: string;
    email: string | null;
    workspace_id: string;
    workspace_slug: string;
    created_at: string;
    tasks: number;
    events: number;
  }[];
  const uu = u[0];

  return {
    handle: base.handle,
    avatar_url: base.avatar_url,
    orgs: base.orgs,
    email: uu?.email ?? null,
    workspace_slug: uu?.workspace_slug ?? null,
    workspace_id: uu?.workspace_id ?? null,
    user_id: uu?.user_id ?? null,
    tasks: uu?.tasks ?? 0,
    events: uu?.events ?? 0,
    created_at: uu?.created_at ?? null,
  };
}

export async function getMemberTasks(handle: string): Promise<TaskRow[]> {
  return (await sql`
    SELECT t.id, t.title, t.status, t.node_type::text AS node_type, t.repo,
           w.slug AS workspace_slug, t.created_at, t.github_url
    FROM tasks t
    JOIN users u ON u.id = t.owner_user_id
    JOIN workspaces w ON w.id = u.workspace_id
    WHERE w.slug = ${handle}
    ORDER BY t.created_at DESC LIMIT 100
  `) as TaskRow[];
}

export interface RepoRow {
  repo: string;
  events: number;
  last_at: string;
}

export async function getRepos(): Promise<RepoRow[]> {
  return (await sql`
    SELECT payload->>'repository' AS repo,
      count(*)::int AS events,
      max(ingested_at) AS last_at
    FROM events
    WHERE source = 'github' AND payload->>'repository' IS NOT NULL
    GROUP BY 1 ORDER BY events DESC
  `) as RepoRow[];
}

export interface GhRepo {
  full_name: string;
  org: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  license: string | null;
  is_private: boolean;
  is_archived: boolean;
  is_fork: boolean;
  pushed_at: string;
  topics: string[];
  html_url: string;
}

export async function getGhRepos(): Promise<GhRepo[]> {
  return (await sql`
    SELECT full_name, org, name, description, language, stars, forks, watchers,
      open_issues, license, is_private, is_archived, is_fork, pushed_at,
      coalesce(topics, '{}') AS topics, html_url
    FROM gh_repos
    ORDER BY pushed_at DESC NULLS LAST
  `) as GhRepo[];
}

export async function getPinnedRepos(limit = 6): Promise<GhRepo[]> {
  return (await sql`
    SELECT full_name, org, name, description, language, stars, forks, watchers,
      open_issues, license, is_private, is_archived, is_fork, pushed_at,
      coalesce(topics, '{}') AS topics, html_url
    FROM gh_repos
    WHERE NOT is_archived AND NOT is_fork
    ORDER BY stars DESC, pushed_at DESC
    LIMIT ${limit}
  `) as GhRepo[];
}

export async function getTrendingRepos(limit = 10): Promise<GhRepo[]> {
  return (await sql`
    SELECT full_name, org, name, description, language, stars, forks, watchers,
      open_issues, license, is_private, is_archived, is_fork, pushed_at,
      coalesce(topics, '{}') AS topics, html_url
    FROM gh_repos
    WHERE NOT is_archived AND NOT is_fork
    ORDER BY pushed_at DESC, stars DESC
    LIMIT ${limit}
  `) as GhRepo[];
}

export interface GhStats {
  repos: number;
  public_repos: number;
  private_repos: number;
  pulls: number;
  issues: number;
  stars: number;
  forks: number;
  languages: number;
  members: number;
  orgs: number;
}

export async function getGhStats(): Promise<GhStats> {
  const rows = (await sql`
    SELECT
      (SELECT count(*)::int FROM gh_repos WHERE NOT is_archived) AS repos,
      (SELECT count(*)::int FROM gh_repos WHERE NOT is_archived AND NOT is_private) AS public_repos,
      (SELECT count(*)::int FROM gh_repos WHERE NOT is_archived AND is_private) AS private_repos,
      (SELECT count(*)::int FROM gh_pulls) AS pulls,
      (SELECT count(*)::int FROM gh_issues) AS issues,
      (SELECT coalesce(sum(stars),0)::int FROM gh_repos) AS stars,
      (SELECT coalesce(sum(forks),0)::int FROM gh_repos) AS forks,
      (SELECT count(DISTINCT language)::int FROM gh_repos WHERE language IS NOT NULL) AS languages,
      (SELECT count(DISTINCT handle)::int FROM member_orgs) AS members,
      (SELECT count(DISTINCT org)::int FROM member_orgs) AS orgs
  `) as GhStats[];
  return rows[0];
}

export interface LanguageStat {
  language: string;
  repos: number;
  stars: number;
}

export async function getLanguageFootprint(): Promise<LanguageStat[]> {
  return (await sql`
    SELECT language, count(*)::int AS repos, coalesce(sum(stars),0)::int AS stars
    FROM gh_repos
    WHERE language IS NOT NULL AND NOT is_archived
    GROUP BY language
    ORDER BY repos DESC, stars DESC
  `) as LanguageStat[];
}

export interface HeatCell {
  date: string;
  count: number;
}

export async function getContribHeatmap(weeks = 26): Promise<HeatCell[]> {
  const days = weeks * 7;
  const rows = (await sql`
    SELECT to_char(date_trunc('day', ingested_at), 'YYYY-MM-DD') AS date,
      count(*)::int AS count
    FROM events
    WHERE ingested_at >= now() - (${days} || ' days')::interval
    GROUP BY 1
  `) as HeatCell[];
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: HeatCell[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export interface GhPull {
  repo: string;
  number: number;
  title: string;
  author: string | null;
  author_avatar: string | null;
  draft: boolean;
  labels: { name: string; color: string }[];
  additions: number | null;
  deletions: number | null;
  comments: number;
  ci: string | null;
  created_at: string;
  head_ref: string | null;
  base_ref: string | null;
  html_url: string;
}

export async function getGhPulls(): Promise<GhPull[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, draft, labels,
      additions, deletions, comments, ci, created_at, head_ref, base_ref, html_url
    FROM gh_pulls
    ORDER BY created_at DESC
  `) as GhPull[];
}

export interface GhIssue {
  repo: string;
  number: number;
  title: string;
  author: string | null;
  author_avatar: string | null;
  labels: { name: string; color: string }[];
  comments: number;
  assignee: string | null;
  assignee_avatar: string | null;
  milestone: string | null;
  priority: string;
  created_at: string;
  html_url: string;
}

export async function getGhIssues(limit = 80): Promise<GhIssue[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, labels, comments,
      assignee, assignee_avatar, milestone, priority, created_at, html_url
    FROM gh_issues
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
        WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ${limit}
  `) as GhIssue[];
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export async function getIssuePriorityCounts(): Promise<PriorityCount[]> {
  const rows = (await sql`
    SELECT priority, count(*)::int AS count FROM gh_issues GROUP BY priority
  `) as PriorityCount[];
  const order = ["critical", "high", "medium", "low"];
  const map = new Map(rows.map((r) => [r.priority, r.count]));
  return order.map((priority) => ({ priority, count: map.get(priority) ?? 0 }));
}

export interface TopicStat {
  topic: string;
  repos: number;
}

export async function getTopics(limit = 24): Promise<TopicStat[]> {
  return (await sql`
    SELECT topic, count(*)::int AS repos
    FROM (SELECT unnest(topics) AS topic FROM gh_repos WHERE NOT is_archived) t
    GROUP BY topic
    ORDER BY repos DESC, topic ASC
    LIMIT ${limit}
  `) as TopicStat[];
}

export async function memberExists(
  handle: string,
): Promise<{ handle: string; avatar_url: string | null } | null> {
  const rows = (await sql`
    SELECT handle, max(avatar_url) AS avatar_url
    FROM member_orgs WHERE lower(handle) = lower(${handle})
    GROUP BY handle LIMIT 1
  `) as { handle: string; avatar_url: string | null }[];
  return rows[0] ?? null;
}

export interface Account {
  username: string;
  password_hash: string;
  role: "admin" | "employee";
  handle: string | null;
  display_name: string | null;
}

export async function getAccountByUsername(
  username: string,
): Promise<Account | null> {
  const rows = (await sql`
    SELECT username, password_hash, role, handle, display_name
    FROM accounts WHERE lower(username) = lower(${username}) LIMIT 1
  `) as Account[];
  return rows[0] ?? null;
}

export async function getAccountByIdentifier(
  id: string,
): Promise<Account | null> {
  const rows = (await sql`
    SELECT username, password_hash, role, handle, display_name
    FROM accounts
    WHERE lower(username) = lower(${id}) OR lower(handle) = lower(${id})
    LIMIT 1
  `) as Account[];
  return rows[0] ?? null;
}

export interface AccountRow {
  username: string;
  role: "admin" | "employee";
  handle: string | null;
  avatar_url: string | null;
}

export async function listAccounts(): Promise<AccountRow[]> {
  return (await sql`
    SELECT a.username, a.role, a.handle,
      (SELECT max(mo.avatar_url) FROM member_orgs mo
         WHERE lower(mo.handle) = lower(a.handle)) AS avatar_url
    FROM accounts a
    ORDER BY (a.role = 'admin') DESC, a.username ASC
  `) as AccountRow[];
}

export async function countAdmins(): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS n FROM accounts WHERE role = 'admin'
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function setAccountRole(
  username: string,
  role: "admin" | "employee",
): Promise<boolean> {
  const rows = (await sql`
    UPDATE accounts SET role = ${role}
    WHERE lower(username) = lower(${username}) RETURNING username
  `) as { username: string }[];
  return rows.length > 0;
}

export async function updatePassword(
  username: string,
  passwordHash: string,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE accounts SET password_hash = ${passwordHash}
    WHERE lower(username) = lower(${username}) RETURNING username
  `) as { username: string }[];
  return rows.length > 0;
}

export async function recordLogin(input: {
  sid: string;
  username: string;
  role: string;
  handle: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO auth_sessions (sid, username, role, handle, ip, user_agent)
    VALUES (${input.sid}, ${input.username}, ${input.role}, ${input.handle},
            ${input.ip}, ${input.userAgent})
    ON CONFLICT (sid) DO NOTHING`;
}

export async function touchSession(sid: string): Promise<void> {
  if (!sid) return;
  await sql`
    UPDATE auth_sessions SET last_seen_at = now()
    WHERE sid = ${sid} AND logout_at IS NULL`;
}

export async function recordLogout(sid: string, reason: string): Promise<void> {
  if (!sid) return;
  await sql`
    UPDATE auth_sessions
    SET logout_at = now(), logout_reason = ${reason}, last_seen_at = now()
    WHERE sid = ${sid} AND logout_at IS NULL`;
}

export interface SessionRow {
  sid: string;
  username: string;
  role: string;
  handle: string | null;
  avatar_url: string | null;
  ip: string | null;
  user_agent: string | null;
  login_at: string;
  last_seen_at: string;
  logout_at: string | null;
  logout_reason: string | null;
}

export interface SearchResults {
  repos: {
    full_name: string;
    name: string;
    description: string | null;
    html_url: string;
    language: string | null;
  }[];
  pulls: { repo: string; number: number; title: string; html_url: string }[];
  issues: {
    repo: string;
    number: number;
    title: string;
    html_url: string;
    priority: string;
  }[];
  members: { handle: string; avatar_url: string | null }[];
}

export async function searchAll(q: string): Promise<SearchResults> {
  const term = q.trim();
  if (term.length < 2) {
    return { repos: [], pulls: [], issues: [], members: [] };
  }
  const like = `%${term}%`;
  const [repos, pulls, issues, members] = await Promise.all([
    sql`
      SELECT full_name, name, description, html_url, language
      FROM gh_repos
      WHERE NOT is_archived AND (name ILIKE ${like} OR description ILIKE ${like}
        OR array_to_string(topics, ' ') ILIKE ${like})
      ORDER BY pushed_at DESC LIMIT 6`,
    sql`
      SELECT repo, number, title, html_url FROM gh_pulls
      WHERE title ILIKE ${like} OR repo ILIKE ${like}
      ORDER BY created_at DESC LIMIT 6`,
    sql`
      SELECT repo, number, title, html_url, priority FROM gh_issues
      WHERE title ILIKE ${like} OR repo ILIKE ${like}
      ORDER BY created_at DESC LIMIT 6`,
    sql`
      SELECT handle, max(avatar_url) AS avatar_url FROM member_orgs
      WHERE handle ILIKE ${like} GROUP BY handle ORDER BY handle LIMIT 6`,
  ]);
  return {
    repos: repos as SearchResults["repos"],
    pulls: pulls as SearchResults["pulls"],
    issues: issues as SearchResults["issues"],
    members: members as SearchResults["members"],
  };
}

export async function getRecentSessions(limit = 50): Promise<SessionRow[]> {
  return (await sql`
    SELECT s.sid, s.username, s.role, s.handle, s.ip, s.user_agent,
      s.login_at, s.last_seen_at, s.logout_at, s.logout_reason,
      (SELECT max(mo.avatar_url) FROM member_orgs mo
         WHERE lower(mo.handle) = lower(s.handle)) AS avatar_url
    FROM auth_sessions s
    ORDER BY s.login_at DESC
    LIMIT ${limit}
  `) as SessionRow[];
}

export interface ActivityRow {
  id: string;
  source: EventSource;
  kind: string;
  occurred_at: string;
  ingested_at: string;
  repository: string | null;
  branch: string | null;
  message: string | null;
  title: string | null;
  number: string | null;
  sha: string | null;
  action: string | null;
}

export async function getMemberActivity(
  workspace: string,
  limit = 30,
): Promise<ActivityRow[]> {
  return (await sql`
    SELECT e.id, e.source, e.kind, e.occurred_at, e.ingested_at,
      e.payload->>'repository' AS repository,
      e.payload->>'branch' AS branch,
      e.payload->>'message' AS message,
      e.payload->>'title' AS title,
      e.payload->>'number' AS number,
      e.payload->>'sha' AS sha,
      e.payload->>'action' AS action
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    WHERE w.slug = ${workspace}
    ORDER BY e.ingested_at DESC LIMIT ${limit}
  `) as ActivityRow[];
}

export interface ActivityStats {
  d7: number;
  d30: number;
  total: number;
  last_at: string | null;
}

export async function getMemberActivityStats(
  workspace: string,
): Promise<ActivityStats> {
  const rows = (await sql`
    SELECT
      (SELECT count(*)::int FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE w.slug = ${workspace} AND e.ingested_at >= now() - interval '7 days') AS d7,
      (SELECT count(*)::int FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE w.slug = ${workspace} AND e.ingested_at >= now() - interval '30 days') AS d30,
      (SELECT count(*)::int FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE w.slug = ${workspace}) AS total,
      (SELECT max(e.ingested_at) FROM events e JOIN workspaces w ON w.id = e.workspace_id
        WHERE w.slug = ${workspace}) AS last_at
  `) as ActivityStats[];
  return rows[0];
}

export async function getMyPulls(handle: string): Promise<GhPull[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, draft, labels,
      additions, deletions, comments, ci, created_at, head_ref, base_ref, html_url
    FROM gh_pulls WHERE lower(author) = lower(${handle})
    ORDER BY created_at DESC
  `) as GhPull[];
}

export async function getMyIssues(handle: string): Promise<GhIssue[]> {
  return (await sql`
    SELECT repo, number, title, author, author_avatar, labels, comments,
      assignee, assignee_avatar, milestone, priority, created_at, html_url
    FROM gh_issues
    WHERE lower(author) = lower(${handle}) OR lower(assignee) = lower(${handle})
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
        WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
  `) as GhIssue[];
}

export interface MyStats {
  open_tasks: number;
  pulls: number;
  issues: number;
  events: number;
}

export async function getMyStats(handle: string): Promise<MyStats> {
  const rows = (await sql`
    SELECT
      (SELECT count(*)::int FROM tasks t
         JOIN users u ON u.id = t.owner_user_id
         JOIN workspaces w ON w.id = u.workspace_id
         WHERE w.slug = ${handle} AND t.status IN ('proposed','acked','in_progress')) AS open_tasks,
      (SELECT count(*)::int FROM gh_pulls WHERE lower(author) = lower(${handle})) AS pulls,
      (SELECT count(*)::int FROM gh_issues
         WHERE lower(author) = lower(${handle}) OR lower(assignee) = lower(${handle})) AS issues,
      (SELECT count(*)::int FROM events e
         JOIN workspaces w ON w.id = e.workspace_id WHERE w.slug = ${handle}) AS events
  `) as MyStats[];
  return rows[0];
}

export interface AssignInput {
  handle: string;
  title: string;
  body?: string;
  repo?: string;
  githubUrl?: string | null;
}

export async function assignTask(
  input: AssignInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title || title.length > 280) {
    return { ok: false, error: "Title must be 1..280 characters." };
  }
  const rows = (await sql`
    SELECT u.id AS user_id, u.workspace_id
    FROM users u JOIN workspaces w ON w.id = u.workspace_id
    WHERE w.slug = ${input.handle} LIMIT 1
  `) as { user_id: string; workspace_id: string }[];
  if (rows.length === 0) {
    return { ok: false, error: "No workspace for this member yet." };
  }
  const { user_id, workspace_id } = rows[0];
  await sql`
    INSERT INTO tasks (workspace_id, node_type, title, body, repo, owner_user_id, status, github_url)
    VALUES (${workspace_id}, 'intent', ${title},
            ${input.body?.trim() || null}, ${input.repo?.trim() || null},
            ${user_id}, 'acked', ${input.githubUrl || null})
  `;
  return { ok: true };
}
