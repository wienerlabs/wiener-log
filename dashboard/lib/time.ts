import { sql } from "@/lib/db";

const GAP_MS = 30 * 60 * 1000;
const MIN_SESSION_MS = 10 * 60 * 1000;

type Ev = { t: number; repo: string | null };

function sessionize(events: Ev[]): { minutes: number; repo: string | null }[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const sessions: { minutes: number; repo: string | null }[] = [];
  let start = sorted[0].t;
  let prev = sorted[0].t;
  let repoCount = new Map<string, number>();
  const bump = (r: string | null) => {
    if (r) repoCount.set(r, (repoCount.get(r) ?? 0) + 1);
  };
  bump(sorted[0].repo);
  const flush = () => {
    const dur = Math.max(prev - start, MIN_SESSION_MS);
    let top: string | null = null;
    let max = 0;
    for (const [r, c] of repoCount)
      if (c > max) {
        max = c;
        top = r;
      }
    sessions.push({ minutes: dur / 60000, repo: top });
  };
  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.t - prev > GAP_MS) {
      flush();
      start = e.t;
      repoCount = new Map();
    }
    prev = e.t;
    bump(e.repo);
  }
  flush();
  return sessions;
}

export interface MemberTime {
  handle: string;
  minutes: number;
  sessions: number;
  events: number;
}
export interface ProjectTime {
  repo: string;
  minutes: number;
}
export interface DayTime {
  date: string;
  minutes: number;
}
export interface TimeReport {
  from: string;
  days: number;
  totalMinutes: number;
  activeMembers: number;
  perMember: MemberTime[];
  perProject: ProjectTime[];
  perDay: DayTime[];
}

export async function getTeamTimeReport(days = 7): Promise<TimeReport> {
  const rows = (await sql`
    SELECT w.slug AS handle, e.payload->>'repository' AS repo,
      extract(epoch from e.ingested_at) * 1000 AS ts,
      to_char(date_trunc('day', e.ingested_at), 'YYYY-MM-DD') AS day
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    WHERE e.source IN ('git', 'claude_code')
      AND e.ingested_at >= now() - (${days} || ' days')::interval
      AND w.slug IN (SELECT DISTINCT handle FROM member_orgs)
    ORDER BY w.slug, e.ingested_at
  `) as { handle: string; repo: string | null; ts: number; day: string }[];

  const byMember = new Map<string, Ev[]>();
  const eventsByMember = new Map<string, number>();
  for (const r of rows) {
    if (!byMember.has(r.handle)) byMember.set(r.handle, []);
    byMember.get(r.handle)!.push({ t: Number(r.ts), repo: r.repo });
    eventsByMember.set(r.handle, (eventsByMember.get(r.handle) ?? 0) + 1);
  }

  const perMember: MemberTime[] = [];
  const projectMinutes = new Map<string, number>();
  let totalMinutes = 0;
  for (const [handle, evs] of byMember) {
    const sessions = sessionize(evs);
    const minutes = sessions.reduce((a, s) => a + s.minutes, 0);
    totalMinutes += minutes;
    perMember.push({
      handle,
      minutes,
      sessions: sessions.length,
      events: eventsByMember.get(handle) ?? 0,
    });
    for (const s of sessions) {
      if (s.repo)
        projectMinutes.set(s.repo, (projectMinutes.get(s.repo) ?? 0) + s.minutes);
    }
  }
  perMember.sort((a, b) => b.minutes - a.minutes);

  const perProject = [...projectMinutes.entries()]
    .map(([repo, minutes]) => ({ repo, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const dayMap = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  const dayEvents = new Map<string, Map<string, Ev[]>>();
  for (const r of rows) {
    if (!dayEvents.has(r.day)) dayEvents.set(r.day, new Map());
    const dm = dayEvents.get(r.day)!;
    if (!dm.has(r.handle)) dm.set(r.handle, []);
    dm.get(r.handle)!.push({ t: Number(r.ts), repo: r.repo });
  }
  for (const [day, members] of dayEvents) {
    let m = 0;
    for (const [, evs] of members)
      m += sessionize(evs).reduce((a, s) => a + s.minutes, 0);
    if (dayMap.has(day)) dayMap.set(day, m);
  }
  const perDay = [...dayMap.entries()].map(([date, minutes]) => ({
    date,
    minutes,
  }));

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - days);
  return {
    from: fromDate.toISOString().slice(0, 10),
    days,
    totalMinutes,
    activeMembers: perMember.filter((m) => m.minutes > 0).length,
    perMember,
    perProject,
    perDay,
  };
}

export async function getMemberTrackedMinutes(
  handle: string,
  days = 7,
): Promise<number> {
  const rows = (await sql`
    SELECT extract(epoch from e.ingested_at) * 1000 AS ts,
      e.payload->>'repository' AS repo
    FROM events e JOIN workspaces w ON w.id = e.workspace_id
    WHERE w.slug = ${handle} AND e.source IN ('git', 'claude_code')
      AND e.ingested_at >= now() - (${days} || ' days')::interval
    ORDER BY e.ingested_at
  `) as { ts: number; repo: string | null }[];
  const sessions = sessionize(rows.map((r) => ({ t: Number(r.ts), repo: r.repo })));
  return sessions.reduce((a, s) => a + s.minutes, 0);
}
