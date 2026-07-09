import {
  getMember,
  getMyStats,
  getMemberTasks,
  getMyPulls,
  getMyIssues,
  getRecentEvents,
  getMemberHeatmap,
  getProposedTasksFor,
} from "@/lib/db";
import { getMemberTrackedMinutes } from "@/lib/time";
import { relativeTime, shortId, formatMinutes } from "@/lib/utils";
import {
  Card,
  StatCard,
  SectionHeader,
  Avatar,
  OrgBadge,
  StatusPill,
  PullRow,
  IssueRow,
  SourcePill,
  Mono,
  Heatmap,
  EmptyState,
} from "@/components/ui";
import { MySuggestions } from "@/components/my-suggestions";
import { PinnedBanner } from "@/components/pinned-banner";

export async function EmployeeHome({ handle }: { handle: string }) {
  const member = await getMember(handle);
  const [stats, tasks, pulls, issues, events, heat, myProposed, teamEvents, tracked] =
    await Promise.all([
      getMyStats(handle),
      getMemberTasks(handle),
      getMyPulls(handle),
      getMyIssues(handle),
      member?.workspace_slug
        ? getRecentEvents(10, { workspace: member.workspace_slug })
        : Promise.resolve([]),
      member?.workspace_slug
        ? getMemberHeatmap(member.workspace_slug, 26)
        : Promise.resolve([]),
      getProposedTasksFor(handle),
      getRecentEvents(6),
      member?.workspace_slug
        ? getMemberTrackedMinutes(member.workspace_slug, 7)
        : Promise.resolve(0),
    ]);

  return (
    <div className="rise">
      <PinnedBanner />
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar handle={handle} src={member?.avatar_url} size={64} />
        <div className="flex-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            Welcome back, {handle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(member?.orgs ?? []).map((o) => (
              <OrgBadge key={o} org={o} />
            ))}
            <span className="text-[13px] text-[var(--color-muted)]">
              Your work across Wiener Labs.
            </span>
          </div>
        </div>
        <a
          href={`https://github.com/${handle}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
        >
          View GitHub profile
        </a>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={String(stats.open_tasks)} accent />
        <StatCard label="Pull requests" value={String(stats.pulls)} />
        <StatCard label="Issues" value={String(stats.issues)} />
        <StatCard label="Events" value={String(stats.events)} />
      </div>

      <MySuggestions tasks={myProposed} />

      {heat.length ? (
        <div className="mt-8">
          <SectionHeader
            title="Your contributions"
            action={
              <span>
                {formatMinutes(tracked)} tracked this week · 26 weeks
              </span>
            }
          />
          <Card className="p-5">
            <Heatmap cells={heat} />
          </Card>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHeader title="Your tasks" action={<span>{tasks.length}</span>} />
          <Card className="overflow-hidden">
            {tasks.length === 0 ? (
              <EmptyState>Nothing assigned to you yet.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {tasks.map((t, i) => (
                    <tr
                      key={t.id}
                      className={
                        i === 0 ? "" : "border-t border-[var(--color-line-soft)]"
                      }
                    >
                      <td className="max-w-[320px] py-3 pl-5 pr-3">
                        <div className="truncate font-medium text-[var(--color-ink)]">
                          {t.title}
                        </div>
                        <Mono>{shortId(t.id)}</Mono>
                        {t.repo ? (
                          <span className="ml-2 text-[11.5px] text-[var(--color-faint)]">
                            {t.repo}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-right">
                        <StatusPill status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <SectionHeader title="Recent activity" />
          <Card className="overflow-hidden">
            {events.length === 0 ? (
              <EmptyState>No activity recorded yet.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {events.map((e, i) => (
                    <tr
                      key={e.id}
                      className={
                        i === 0 ? "" : "border-t border-[var(--color-line-soft)]"
                      }
                    >
                      <td className="w-0 whitespace-nowrap py-3 pl-5 pr-3">
                        <SourcePill source={e.source} />
                      </td>
                      <td className="py-3 pr-3 font-medium text-[var(--color-ink)]">
                        {e.kind}
                      </td>
                      <td className="w-0 whitespace-nowrap py-3 pr-5 text-right text-[12px] text-[var(--color-faint)]">
                        {relativeTime(e.ingested_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Your pull requests"
          action={<span>{pulls.length} open</span>}
        />
        <Card className="overflow-hidden">
          {pulls.length === 0 ? (
            <EmptyState>No open pull requests authored by you.</EmptyState>
          ) : (
            <div className="divide-y divide-[var(--color-line-soft)]">
              {pulls.map((p) => (
                <PullRow key={`${p.repo}#${p.number}`} pull={p} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Your issues"
          action={<span>{issues.length} open</span>}
        />
        <Card className="overflow-hidden">
          {issues.length === 0 ? (
            <EmptyState>No open issues assigned to or opened by you.</EmptyState>
          ) : (
            <div className="divide-y divide-[var(--color-line-soft)]">
              {issues.map((i) => (
                <IssueRow key={`${i.repo}#${i.number}`} issue={i} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader title="Across the team" />
        <Card className="overflow-hidden">
          {teamEvents.length === 0 ? (
            <EmptyState>Quiet across the team right now.</EmptyState>
          ) : (
            <table className="w-full text-[13px]">
              <tbody>
                {teamEvents.map((e, i) => (
                  <tr
                    key={e.id}
                    className={
                      i === 0 ? "" : "border-t border-[var(--color-line-soft)]"
                    }
                  >
                    <td className="w-0 whitespace-nowrap py-3 pl-5 pr-3">
                      <SourcePill source={e.source} />
                    </td>
                    <td className="py-3 pr-3 font-medium text-[var(--color-ink)]">
                      {e.kind}
                    </td>
                    <td className="hidden max-w-[240px] truncate py-3 pr-3 text-[var(--color-muted)] sm:table-cell">
                      {e.label ?? ""}
                    </td>
                    <td className="w-0 whitespace-nowrap py-3 pr-5 text-right text-[12px] text-[var(--color-faint)]">
                      {relativeTime(e.ingested_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
