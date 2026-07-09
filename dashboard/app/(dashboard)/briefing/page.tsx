import {
  getBriefing,
  getUnreadMentions,
  getProposedTasks,
  getProjectMomentum,
  getQuietMembers,
  getTeamPresence,
} from "@/lib/db";
import { getStalePulls, getUnassignedCritical } from "@/lib/digest";
import { getSession, isAdmin } from "@/lib/session";
import { regenerateBriefingAction } from "@/lib/cockpit-actions";
import { relativeTime } from "@/lib/utils";
import { Card, PageHeader, SectionHeader, Avatar, EmptyState } from "@/components/ui";
import {
  Radar,
  RefreshCw,
  GitPullRequestArrow,
  TriangleAlert,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  MessagesSquare,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const shortRepo = (full: string) => full.split("/").pop() || full;

export default async function BriefingPage() {
  const session = await getSession();
  if (!(await isAdmin())) redirect("/");
  const me =
    session?.handle && session.handle !== "admin"
      ? session.handle
      : session?.username || "";
  const today = new Date().toISOString().slice(0, 10);

  const [briefing, mentions, stale, unassigned, proposed, momentum, quiet, presence] =
    await Promise.all([
      getBriefing(today),
      getUnreadMentions(me, 6),
      getStalePulls(7, 8),
      getUnassignedCritical(8),
      getProposedTasks(12),
      getProjectMomentum(10),
      getQuietMembers(3, 6),
      getTeamPresence(),
    ]);

  const onlineNow = presence.filter(
    (p) => p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000,
  ).length;
  const bullets = (briefing?.summary || "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="rise">
      <PageHeader
        title="Briefing"
        subtitle="Your portfolio, triaged. What needs you today."
      />

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="size-[18px] text-[var(--color-accent)]" strokeWidth={2} />
            <span className="text-[14px] font-semibold text-[var(--color-ink)]">
              Today
            </span>
            {briefing ? (
              <span className="text-[11.5px] text-[var(--color-faint)]">
                {relativeTime(briefing.created_at)}
              </span>
            ) : null}
          </div>
          <form action={regenerateBriefingAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
            >
              <RefreshCw className="size-[13px]" strokeWidth={2} />
              {briefing ? "Regenerate" : "Generate"}
            </button>
          </form>
        </div>
        {bullets.length ? (
          <ul className="flex flex-col gap-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <span className="text-[14px] leading-relaxed text-[var(--color-ink)]">
                  {b}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--color-faint)]">
            No briefing yet. Generate one to triage the portfolio.
          </p>
        )}
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          {mentions.length ? (
            <section>
              <SectionHeader
                title="Needs your reply"
                action={<span>{mentions.length}</span>}
              />
              <Card className="overflow-hidden">
                <div className="divide-y divide-[var(--color-line-soft)]">
                  {mentions.map((m) => (
                    <Link
                      key={m.id}
                      href={m.link || "/chat"}
                      className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                    >
                      <MessagesSquare
                        className="mt-0.5 size-[15px] shrink-0 text-[var(--color-accent)]"
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-[var(--color-ink)]">
                          <span className="font-medium">@{m.actor}</span> mentioned you
                        </div>
                        {m.body ? (
                          <div className="truncate text-[12px] text-[var(--color-muted)]">
                            {m.body}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--color-faint)]">
                        {relativeTime(m.created_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            </section>
          ) : null}

          <section>
            <SectionHeader
              title="Needs your call"
              action={
                <Link
                  href="/tasks"
                  className="text-[var(--color-accent)] transition-opacity hover:opacity-70"
                >
                  {proposed.length} proposed
                </Link>
              }
            />
            <Card className="overflow-hidden">
              {unassigned.length === 0 ? (
                <EmptyState>No unassigned critical or high issues.</EmptyState>
              ) : (
                <div className="divide-y divide-[var(--color-line-soft)]">
                  {unassigned.map((i) => (
                    <a
                      key={`${i.repo}#${i.number}`}
                      href={i.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                    >
                      <TriangleAlert
                        className={`mt-0.5 size-[15px] shrink-0 ${i.priority === "critical" ? "text-[var(--color-danger)]" : "text-[var(--color-warn)]"}`}
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                          {i.title}
                        </div>
                        <div className="text-[11.5px] text-[var(--color-faint)]">
                          {shortRepo(i.repo)} #{i.number} · {i.priority}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader
              title="Review queue"
              action={
                <Link
                  href="/pulls"
                  className="text-[var(--color-accent)] transition-opacity hover:opacity-70"
                >
                  {stale.length} stale
                </Link>
              }
            />
            <Card className="overflow-hidden">
              {stale.length === 0 ? (
                <EmptyState>No pull requests waiting over a week.</EmptyState>
              ) : (
                <div className="divide-y divide-[var(--color-line-soft)]">
                  {stale.map((p) => (
                    <a
                      key={`${p.repo}#${p.number}`}
                      href={p.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                    >
                      <GitPullRequestArrow
                        className="mt-0.5 size-[15px] shrink-0 text-[var(--color-faint)]"
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                          {p.title}
                        </div>
                        <div className="text-[11.5px] text-[var(--color-faint)]">
                          {shortRepo(p.repo)} #{p.number}
                          {p.author ? ` · @${p.author}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--color-faint)]">
                        {relativeTime(p.created_at)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Momentum" action={<span>7 vs prior 7 days</span>} />
            <Card className="overflow-hidden">
              {momentum.length === 0 ? (
                <EmptyState>No project activity recorded yet.</EmptyState>
              ) : (
                <div className="divide-y divide-[var(--color-line-soft)]">
                  {momentum.map((m) => {
                    const cooling = m.prev >= 4 && m.cur < m.prev / 2;
                    const up = m.cur > m.prev;
                    return (
                      <Link
                        key={m.repo}
                        href={`/projects/${m.name}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                            {m.name}
                          </div>
                          {cooling ? (
                            <div className="text-[11px] font-medium text-[var(--color-danger)]">
                              cooling off
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[12.5px] tabular-nums text-[var(--color-muted)]">
                          {m.cur}
                          <span className="text-[var(--color-faint)]"> / {m.prev}</span>
                        </span>
                        {cooling ? (
                          <TrendingDown
                            className="size-[15px] text-[var(--color-danger)]"
                            strokeWidth={2}
                          />
                        ) : up ? (
                          <TrendingUp
                            className="size-[15px] text-[var(--color-ok)]"
                            strokeWidth={2}
                          />
                        ) : (
                          <span className="size-[15px]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader
              title="People"
              action={
                <Link
                  href="/members"
                  className="text-[var(--color-accent)] transition-opacity hover:opacity-70"
                >
                  {onlineNow} online
                </Link>
              }
            />
            <Card className="p-4">
              {quiet.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-[13px] text-[var(--color-muted)]">
                  <Users className="size-[15px] text-[var(--color-faint)]" strokeWidth={2} />
                  Everyone has been active this week.
                </div>
              ) : (
                <div>
                  <div className="mb-2.5 text-[11.5px] font-medium text-[var(--color-faint)]">
                    Quiet for 3+ days
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {quiet.map((q) => (
                      <Link
                        key={q.handle}
                        href={`/members/${q.handle}`}
                        className="flex items-center gap-2.5"
                      >
                        <Avatar handle={q.handle} src={q.avatar} size={28} />
                        <span className="flex-1 text-[13px] font-medium text-[var(--color-ink)]">
                          @{q.handle}
                        </span>
                        <span className="text-[11.5px] text-[var(--color-faint)]">
                          {q.last_event ? relativeTime(q.last_event) : "no activity"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
