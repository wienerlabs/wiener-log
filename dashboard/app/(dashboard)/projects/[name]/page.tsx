import {
  getProjectByName,
  getRepoPulls,
  getRepoIssues,
  getProjectContributors,
  getRepoTasks,
  getProjectActivity,
  getProjectSuggestions,
} from "@/lib/db";
import {
  Card,
  SectionHeader,
  StatCard,
  PullRow,
  IssueRow,
  Heatmap,
  Avatar,
  LanguageDot,
  VisibilityBadge,
  OrgBadge,
  StatusPill,
  Mono,
  EmptyState,
  priorityMeta,
} from "@/components/ui";
import { ProjectSuggestions } from "@/components/project-suggestions";
import { relativeTime, shortId, formatNumber } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, GitFork, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

function statusOf(pushedAt: string): { label: string; c: string; dot: string } {
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86400000;
  if (days < 14) return { label: "Active", c: "text-[var(--color-ok)]", dot: "#1a7f45" };
  if (days < 60) return { label: "Idle", c: "text-[var(--color-warn)]", dot: "#9a6a00" };
  return { label: "Dormant", c: "text-[var(--color-faint)]", dot: "#a1a1aa" };
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const repo = await getProjectByName(decodeURIComponent(name));
  if (!repo) notFound();

  const [pulls, issues, contributors, tasks, activity, suggestions] =
    await Promise.all([
      getRepoPulls(repo.full_name),
      getRepoIssues(repo.full_name),
      getProjectContributors(repo.full_name),
      getRepoTasks(repo.full_name),
      getProjectActivity(repo.full_name, 84),
      getProjectSuggestions(repo.full_name),
    ]);

  const status = statusOf(repo.pushed_at);
  const activityTotal = activity.reduce((a, c) => a + c.count, 0);
  const priorities = ["critical", "high", "medium", "low"].map((p) => ({
    p,
    n: issues.filter((i) => i.priority === p).length,
  }));

  return (
    <div className="rise">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <ChevronLeft className="size-4" /> Projects
      </Link>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
          >
            {repo.name}
          </a>
          <VisibilityBadge isPrivate={repo.is_private} />
          <OrgBadge org={repo.org} />
          <span
            className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${status.c}`}
          >
            <span
              className="inline-block size-[7px] rounded-full"
              style={{ backgroundColor: status.dot }}
            />
            {status.label}
          </span>
        </div>
        <p className="mt-2 max-w-[720px] text-[14px] text-[var(--color-muted)]">
          {repo.description || "No description provided."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {repo.language ? <LanguageDot language={repo.language} /> : null}
          {repo.stars > 0 ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-muted)]">
              <Star className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
              {formatNumber(repo.stars)}
            </span>
          ) : null}
          {repo.forks > 0 ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-muted)]">
              <GitFork className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
              {formatNumber(repo.forks)}
            </span>
          ) : null}
          {repo.license ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-muted)]">
              <Scale className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
              {repo.license}
            </span>
          ) : null}
          {repo.topics.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-accent)]"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open pull requests" value={String(pulls.length)} accent />
        <StatCard label="Open issues" value={String(issues.length)} />
        <StatCard label="Contributors" value={String(contributors.length)} />
        <StatCard
          label="Activity, 12w"
          value={formatNumber(activityTotal)}
          sub={`last active ${relativeTime(repo.pushed_at)}`}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Activity"
            action={<span>{activityTotal} events, 12 weeks</span>}
          />
          <Card className="p-5">
            <Heatmap cells={activity} />
          </Card>
        </div>
        <div>
          <SectionHeader title="Issue priority" />
          <Card className="p-5">
            <div className="flex flex-col gap-3">
              {priorities.map(({ p, n }) => {
                const meta = priorityMeta(p);
                return (
                  <div key={p} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)]">
                      <span
                        className="inline-block size-[8px] rounded-full"
                        style={{ backgroundColor: meta.dot }}
                      />
                      {meta.label}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--color-ink)]">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <ProjectSuggestions
          groups={[
            {
              name: repo.name,
              full_name: repo.full_name,
              language: repo.language,
              suggestions,
            },
          ]}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            title="Open pull requests"
            action={<span>{pulls.length}</span>}
          />
          <Card className="overflow-hidden">
            {pulls.length === 0 ? (
              <EmptyState>No open pull requests.</EmptyState>
            ) : (
              <div className="divide-y divide-[var(--color-line-soft)]">
                {pulls.slice(0, 8).map((p) => (
                  <PullRow key={p.number} pull={p} />
                ))}
              </div>
            )}
          </Card>
        </div>
        <div>
          <SectionHeader title="Open issues" action={<span>{issues.length}</span>} />
          <Card className="overflow-hidden">
            {issues.length === 0 ? (
              <EmptyState>No open issues.</EmptyState>
            ) : (
              <div className="divide-y divide-[var(--color-line-soft)]">
                {issues.slice(0, 8).map((i) => (
                  <IssueRow key={i.number} issue={i} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionHeader
            title="Contributors"
            action={<span>{contributors.length}</span>}
          />
          <Card className="p-5">
            {contributors.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--color-faint)]">
                No recent contributors.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {contributors.slice(0, 12).map((c) => (
                  <Link
                    key={c.handle}
                    href={`/members/${c.handle}`}
                    className="flex items-center gap-2.5"
                  >
                    <Avatar handle={c.handle} src={c.avatar} size={26} />
                    <span className="text-[13px] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-accent)]">
                      {c.handle}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <SectionHeader
            title="Related tasks"
            action={<span>{tasks.length}</span>}
          />
          <Card className="overflow-hidden">
            {tasks.length === 0 ? (
              <EmptyState>No WienerLog tasks reference this project yet.</EmptyState>
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
                      <td className="py-3 pl-5 pr-3">
                        <div className="font-medium text-[var(--color-ink)]">
                          {t.title}
                        </div>
                        <span className="text-[11.5px] text-[var(--color-faint)]">
                          @{t.handle}
                        </span>
                        <span className="ml-2">
                          <Mono>{shortId(t.id)}</Mono>
                        </span>
                        {t.github_url ? (
                          <a
                            href={t.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-[11.5px] font-medium text-[var(--color-accent)] hover:opacity-70"
                          >
                            GitHub
                          </a>
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
      </div>
    </div>
  );
}
