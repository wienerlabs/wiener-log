import {
  getMember,
  getMemberTasks,
  getRecentEvents,
} from "@/lib/db";
import { relativeTime, shortId } from "@/lib/utils";
import {
  Card,
  StatCard,
  SectionHeader,
  StatusPill,
  SourcePill,
  Mono,
  EmptyState,
  Avatar,
  OrgBadge,
  GithubMark,
} from "@/components/ui";
import { AssignForm } from "@/components/assign-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FolderGit2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const member = await getMember(handle);
  if (!member) notFound();

  const [tasks, events] = await Promise.all([
    getMemberTasks(handle),
    member.workspace_slug
      ? getRecentEvents(15, { workspace: member.workspace_slug })
      : Promise.resolve([]),
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
            className="inline-flex items-center gap-1.5 rounded-[11px] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-black/[0.06] transition-colors hover:bg-[var(--color-line-soft)]"
          >
            <GithubMark className="size-4" /> GitHub
          </a>
          {member.workspace_slug ? (
            <Link
              href={`/workspaces/${member.workspace_slug}`}
              className="inline-flex items-center gap-1.5 rounded-[11px] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-black/[0.06] transition-colors hover:bg-[var(--color-line-soft)]"
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
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

        <div className="lg:col-span-3">
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

      <div className="mt-8">
        <SectionHeader title="Recent activity" />
        <Card className="overflow-hidden">
          {events.length === 0 ? (
            <EmptyState>No events in this workspace yet.</EmptyState>
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
                    <td className="hidden max-w-[240px] truncate py-3 pr-3 text-[var(--color-muted)] sm:table-cell">
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
