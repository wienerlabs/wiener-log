import {
  getGhStats,
  getEventsByDay,
  getContribHeatmap,
  getLanguageFootprint,
  getPinnedRepos,
  getGhPulls,
  getIssuePriorityCounts,
  getRecentEvents,
  getTopActiveProjects,
  getProjectSuggestions,
} from "@/lib/db";
import { formatNumber, relativeTime } from "@/lib/utils";
import {
  Card,
  SectionHeader,
  PageHeader,
  SourcePill,
  Heatmap,
  MiniBars,
  RepoCard,
  LanguageDot,
  langColor,
  EmptyState,
} from "@/components/ui";
import { getStalePulls, getUnassignedCritical } from "@/lib/digest";
import { getSession } from "@/lib/session";
import { EmployeeHome } from "@/components/employee-home";
import { NeedsAttention } from "@/components/needs-attention";
import { ProjectSuggestions } from "@/components/project-suggestions";
import { PinnedBanner } from "@/components/pinned-banner";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session && session.role !== "admin") {
    return <EmployeeHome handle={session.handle} />;
  }

  const [
    stats,
    days,
    heat,
    langs,
    pinned,
    pulls,
    priorities,
    events,
    stalePulls,
    unassigned,
  ] = await Promise.all([
    getGhStats(),
    getEventsByDay(14),
    getContribHeatmap(26),
    getLanguageFootprint(),
    getPinnedRepos(6),
    getGhPulls(),
    getIssuePriorityCounts(),
    getRecentEvents(8),
    getStalePulls(7, 8),
    getUnassignedCritical(8),
  ]);

  const topProjects = await getTopActiveProjects(3);
  const suggestionGroups = await Promise.all(
    topProjects.map(async (p) => ({
      name: p.name,
      full_name: p.full_name,
      language: p.language,
      suggestions: await getProjectSuggestions(p.full_name),
    })),
  );

  const reposBars = langs.slice(0, 7).map((l) => l.repos);
  const pullsByRepo = new Map<string, number>();
  for (const p of pulls)
    pullsByRepo.set(p.repo, (pullsByRepo.get(p.repo) ?? 0) + 1);
  const pullsBars = [...pullsByRepo.values()].sort((a, b) => b - a).slice(0, 7);
  const issuesBars = priorities.map((p) => p.count);
  const activityBars = days.map((d) => d.total);
  const langTotal = langs.reduce((a, l) => a + l.repos, 0) || 1;
  const heatTotal = heat.reduce((a, c) => a + c.count, 0);

  return (
    <div className="rise">
      <PinnedBanner />
      <PageHeader
        title="Your mainline pulse"
        subtitle="What wienerlabs and Sidewinder shipped, observed live."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PulseCard
          href="/repos"
          label="Repositories"
          value={formatNumber(stats.repos)}
          sub={`${stats.public_repos} public · ${stats.private_repos} private`}
          bars={reposBars}
        />
        <PulseCard
          href="/pulls"
          label="Open pull requests"
          value={formatNumber(stats.pulls)}
          sub={`across ${pullsByRepo.size} repositories`}
          bars={pullsBars.length ? pullsBars : [1]}
        />
        <PulseCard
          href="/issues"
          label="Open issues"
          value={formatNumber(stats.issues)}
          sub={`${priorities[0].count} critical · ${priorities[1].count} high`}
          bars={issuesBars}
        />
        <PulseCard
          href="/events"
          label="Events, 14 days"
          value={formatNumber(activityBars.reduce((a, b) => a + b, 0))}
          sub={`${stats.members} members · ${stats.orgs} orgs`}
          bars={activityBars}
        />
      </div>

      <div className="mt-8">
        <ProjectSuggestions groups={suggestionGroups} />
      </div>

      <div className="mt-8">
        <NeedsAttention stalePulls={stalePulls} unassigned={unassigned} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Contribution activity"
            action={<span>{formatNumber(heatTotal)} events, 26 weeks</span>}
          />
          <Card className="p-5">
            <Heatmap cells={heat} />
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-faint)]">
              <span>Less</span>
              {["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"].map(
                (c) => (
                  <span
                    key={c}
                    className="size-[11px] rounded-[3px] ring-1 ring-[var(--color-ring)]"
                    style={{ backgroundColor: c }}
                  />
                ),
              )}
              <span>More</span>
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader
            title="Language footprint"
            action={<span>{stats.languages} languages</span>}
          />
          <Card className="p-5">
            {langs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[var(--color-faint)]">
                No languages detected yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  {langs.slice(0, 8).map((l) => (
                    <span
                      key={l.language}
                      title={`${l.language} · ${l.repos}`}
                      style={{
                        width: `${(l.repos / langTotal) * 100}%`,
                        backgroundColor: langColor(l.language),
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {langs.slice(0, 7).map((l) => (
                    <div
                      key={l.language}
                      className="flex items-center justify-between"
                    >
                      <LanguageDot language={l.language} />
                      <span className="text-[12.5px] font-medium tabular-nums text-[var(--color-ink-soft)]">
                        {Math.round((l.repos / langTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Pinned repositories"
          action={
            <Link
              href="/repos"
              className="text-[var(--color-accent)] transition-opacity hover:opacity-70"
            >
              View all
            </Link>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pinned.map((r) => (
            <RepoCard key={r.full_name} repo={r} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Recent signals"
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

function PulseCard({
  href,
  label,
  value,
  sub,
  bars,
}: {
  href: string;
  label: string;
  value: string;
  sub: ReactNode;
  bars: number[];
}) {
  return (
    <Link href={href} className="block">
      <Card className="p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] font-medium text-[var(--color-muted)]">
              {label}
            </div>
            <div className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--color-ink)]">
              {value}
            </div>
          </div>
          <div className="w-[42%]">
            <MiniBars data={bars} />
          </div>
        </div>
        <div className="mt-3 text-[12px] text-[var(--color-faint)]">{sub}</div>
      </Card>
    </Link>
  );
}
