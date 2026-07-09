import {
  getMember,
  getMemberTasks,
  getMemberActivity,
  getMemberActivityStats,
  listPersonalDocs,
  getMemberExpertise,
} from "@/lib/db";
import { relativeTime, shortId } from "@/lib/utils";
import {
  Card,
  StatCard,
  SectionHeader,
  StatusPill,
  Mono,
  EmptyState,
  Avatar,
  OrgBadge,
  GithubMark,
  LanguageDot,
} from "@/components/ui";
import { ActivityFeed } from "@/components/activity-feed";
import { AssignForm } from "@/components/assign-form";
import { NewDocButton } from "@/components/doc-buttons";
import { isAdmin, getSession } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FolderGit2, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const member = await getMember(handle);
  if (!member) notFound();
  const admin = await isAdmin();
  const session = await getSession();
  const me =
    session?.handle && session.handle !== "admin"
      ? session.handle
      : session?.username || "";
  const isOwn = me.toLowerCase() === handle.toLowerCase();

  const [tasks, activity, activityStats, docs, expertise] = await Promise.all([
    getMemberTasks(handle),
    member.workspace_slug
      ? getMemberActivity(member.workspace_slug, 40)
      : Promise.resolve([]),
    member.workspace_slug
      ? getMemberActivityStats(member.workspace_slug)
      : Promise.resolve({ d7: 0, d30: 0, total: 0, last_at: null }),
    listPersonalDocs(handle),
    getMemberExpertise(member.handle),
  ]);

  return (
    <div className="rise">
      <Link
        href="/members"
        className="mb-6 inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <ChevronLeft className="size-4" /> Members
      </Link>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar handle={member.handle} src={member.avatar_url} size={72} />
        <div className="flex-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            {member.handle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {member.orgs.map((o) => (
              <OrgBadge key={o} org={o} />
            ))}
            {member.email ? (
              <span className="text-[12.5px] text-[var(--color-muted)]">
                {member.email}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://github.com/${member.handle}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
          >
            <GithubMark className="size-4" /> GitHub
          </a>
          {member.workspace_slug ? (
            <Link
              href={`/workspaces/${member.workspace_slug}`}
              className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
            >
              <FolderGit2 className="size-4" /> Workspace
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
        <StatCard label="Events" value={String(member.events)} accent />
        <StatCard label="Tasks" value={String(member.tasks)} />
      </div>

      <div
        className={
          admin
            ? "mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5"
            : "mt-8 grid grid-cols-1 gap-6"
        }
      >
        {admin ? (
          <div className="lg:col-span-2">
            <SectionHeader title="Assign a task" />
            <Card className="p-5">
              {member.workspace_slug ? (
                <AssignForm handle={member.handle} />
              ) : (
                <p className="py-4 text-center text-[13px] text-[var(--color-faint)]">
                  This member has no workspace yet. Run member sync first.
                </p>
              )}
            </Card>
          </div>
        ) : null}

        <div className={admin ? "lg:col-span-3" : ""}>
          <SectionHeader title="Tasks" action={<span>{tasks.length}</span>} />
          <Card className="overflow-hidden">
            {tasks.length === 0 ? (
              <EmptyState>No tasks assigned or synthesized yet.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {tasks.map((t, i) => (
                    <tr
                      key={t.id}
                      className={
                        i === 0
                          ? ""
                          : "border-t border-[var(--color-line-soft)]"
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
                        {t.github_url ? (
                          <a
                            href={t.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-[11.5px] font-medium text-[var(--color-accent)] transition-opacity hover:opacity-70"
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

      {expertise.repos.length ? (
        <div className="mt-8">
          <SectionHeader title="Expertise" action={<span>where they work</span>} />
          <Card className="p-5">
            {expertise.languages.length ? (
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {expertise.languages.slice(0, 6).map((l) => (
                  <LanguageDot key={l.language} language={l.language} />
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {expertise.repos.map((r) => (
                <Link
                  key={r.repo}
                  href={`/projects/${r.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-line-soft)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
                >
                  <FolderGit2 className="size-[13px]" strokeWidth={2} />
                  {r.name}
                  <span className="tabular-nums text-[var(--color-faint)]">
                    {r.contributions}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-8">
        <SectionHeader
          title="Recent activity"
          action={
            <span>
              {activityStats.d7} this week · {activityStats.d30} this month ·{" "}
              {activityStats.total} total
            </span>
          }
        />
        {activityStats.last_at ? (
          <p className="mb-3 text-[12.5px] text-[var(--color-faint)]">
            Last active {relativeTime(activityStats.last_at)}
          </p>
        ) : null}
        <Card className="overflow-hidden">
          {activity.length === 0 ? (
            <EmptyState>No events in this workspace yet.</EmptyState>
          ) : (
            <ActivityFeed rows={activity} />
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Documents"
          action={
            isOwn ? (
              <NewDocButton scope="personal" label="New" />
            ) : (
              <span>{docs.length}</span>
            )
          }
        />
        {docs.length === 0 ? (
          <Card className="px-5 py-8 text-center text-[13px] text-[var(--color-faint)]">
            {isOwn ? "Your personal notes live here." : "No documents."}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <Link key={d.id} href={`/docs/${d.id}`}>
                <Card className="flex h-full flex-col p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex items-start gap-2">
                    <FileText
                      className="mt-0.5 size-4 shrink-0 text-[var(--color-faint)]"
                      strokeWidth={2}
                    />
                    <span className="line-clamp-2 text-[14px] font-semibold text-[var(--color-ink)]">
                      {d.title}
                    </span>
                  </div>
                  <span className="mt-auto pt-3 text-[11.5px] text-[var(--color-faint)]">
                    updated {relativeTime(d.updated_at)}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
