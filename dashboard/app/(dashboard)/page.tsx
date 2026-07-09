import {
  getOverview,
  getEventsByDay,
  getTasksByStatus,
  getRecentEvents,
} from "@/lib/db";
import { formatNumber, relativeTime } from "@/lib/utils";
import {
  Card,
  StatCard,
  SectionHeader,
  PageHeader,
  SourcePill,
  StatusPill,
  EmptyState,
} from "@/components/ui";
import { EventsChart } from "@/components/events-chart";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [ov, days, statuses, events] = await Promise.all([
    getOverview(),
    getEventsByDay(14),
    getTasksByStatus(),
    getRecentEvents(12),
  ]);

  const statusTotal = statuses.reduce((a, s) => a + s.count, 0);

  return (
    <div className="rise">
      <PageHeader
        title="Overview"
        subtitle="Everything the org shipped, observed in real time."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Events today"
          value={formatNumber(ov.events_today)}
          sub={`${formatNumber(ov.events_7d)} this week`}
          accent
        />
        <StatCard label="Events total" value={formatNumber(ov.events_total)} />
        <StatCard label="Tasks" value={formatNumber(ov.tasks_total)} />
        <StatCard label="Members" value={formatNumber(ov.members_total)} />
        <StatCard label="Workspaces" value={formatNumber(ov.workspaces_total)} />
        <StatCard label="Repos" value={formatNumber(ov.repos_total)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Activity" action={<span>Last 14 days</span>} />
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap gap-4 text-[12px] text-[var(--color-muted)]">
              <Legend color="#0071e3" label="GitHub" />
              <Legend color="#a1a1aa" label="Git" />
              <Legend color="#7b3fbf" label="Claude Code" />
            </div>
            <EventsChart data={days} />
          </Card>
        </div>

        <div>
          <SectionHeader title="Tasks by status" />
          <Card className="p-5">
            {statusTotal === 0 ? (
              <div className="py-8 text-center text-[13px] text-[var(--color-faint)]">
                No tasks yet. The engine proposes them once an Anthropic key
                is set.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {statuses.map((s) => (
                  <div key={s.status}>
                    <div className="flex items-center justify-between">
                      <StatusPill status={s.status} />
                      <span className="text-[13px] font-semibold tabular-nums text-[var(--color-ink)]">
                        {s.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-line-soft)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-ink)]/80 transition-all duration-700"
                        style={{
                          width: `${statusTotal ? (s.count / statusTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Recent events"
          action={
            <Link
              href="/events"
              className="text-[var(--color-accent)] transition-opacity hover:opacity-70"
            >
              View all
            </Link>
          }
        />
        <Card className="overflow-hidden">
          {events.length === 0 ? (
            <EmptyState>No events ingested yet.</EmptyState>
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
                    <td className="hidden max-w-[220px] truncate py-3 pr-3 text-[var(--color-muted)] sm:table-cell">
                      {e.label ?? ""}
                    </td>
                    <td className="hidden py-3 pr-3 sm:table-cell">
                      {e.workspace_slug ? (
                        <Link
                          href={`/workspaces/${e.workspace_slug}`}
                          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
                        >
                          {e.workspace_slug}
                        </Link>
                      ) : null}
                    </td>
                    <td className="w-0 whitespace-nowrap py-3 pr-5 text-right text-[12.5px] text-[var(--color-faint)]">
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
