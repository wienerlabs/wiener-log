import { getWorkspace, getTasks, getRecentEvents } from "@/lib/db";
import { relativeTime, shortId } from "@/lib/utils";
import {
  Card,
  StatCard,
  SectionHeader,
  StatusPill,
  SourcePill,
  Mono,
  EmptyState,
} from "@/components/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspaceDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getWorkspace(slug);
  if (!ws) notFound();

  const [tasks, events] = await Promise.all([
    getTasks({ workspace: slug, limit: 40 }),
    getRecentEvents(20, { workspace: slug }),
  ]);

  return (
    <div className="rise">
      <Link
        href="/workspaces"
        className="mb-5 inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <ChevronLeft className="size-4" /> Workspaces
      </Link>

      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
          {ws.name}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--color-muted)]">/{ws.slug}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Events" value={String(ws.events)} accent />
        <StatCard label="Tasks" value={String(ws.tasks)} />
        <StatCard label="Members" value={String(ws.members)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            title="Tasks"
            action={
              <Link
                href={`/tasks`}
                className="text-[var(--color-accent)] hover:opacity-70"
              >
                All tasks
              </Link>
            }
          />
          <Card className="overflow-hidden">
            {tasks.length === 0 ? (
              <EmptyState>No tasks in this workspace.</EmptyState>
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
                      <td className="max-w-[280px] py-3 pl-5 pr-3">
                        <div className="truncate font-medium text-[var(--color-ink)]">
                          {t.title}
                        </div>
                        <Mono>{shortId(t.id)}</Mono>
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

        <div>
          <SectionHeader title="Recent events" />
          <Card className="overflow-hidden">
            {events.length === 0 ? (
              <EmptyState>No events yet.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {events.map((e, i) => (
                    <tr
                      key={e.id}
                      className={
                        i === 0
                          ? ""
                          : "border-t border-[var(--color-line-soft)]"
                      }
                    >
                      <td className="w-0 whitespace-nowrap py-3 pl-5 pr-3">
                        <SourcePill source={e.source} />
                      </td>
                      <td className="py-3 pr-3 font-medium text-[var(--color-ink)]">
                        {e.kind}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-right text-[12.5px] text-[var(--color-faint)]">
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
    </div>
  );
}
