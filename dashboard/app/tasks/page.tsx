import { getTasks, type TaskStatus } from "@/lib/db";
import { relativeTime, shortId } from "@/lib/utils";
import {
  Card,
  PageHeader,
  StatusPill,
  Mono,
  EmptyState,
} from "@/components/ui";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const filters: { key: string; label: string; status?: TaskStatus }[] = [
  { key: "all", label: "All" },
  { key: "proposed", label: "Proposed", status: "proposed" },
  { key: "acked", label: "Acked", status: "acked" },
  { key: "in_progress", label: "In progress", status: "in_progress" },
  { key: "done", label: "Done", status: "done" },
  { key: "rejected", label: "Rejected", status: "rejected" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = filters.find((f) => f.key === status) ?? filters[0];
  const tasks = await getTasks({ status: active.status, limit: 300 });

  return (
    <div className="rise">
      <PageHeader
        title="Tasks"
        subtitle="Retrospective task nodes synthesized from activity."
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/tasks" : `/tasks?status=${f.key}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
              active.key === f.key
                ? "bg-[var(--color-ink)] text-white"
                : "bg-white text-[var(--color-ink-soft)] ring-1 ring-black/[0.06] hover:bg-[var(--color-line-soft)]",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        {tasks.length === 0 ? (
          <EmptyState>
            No tasks{active.status ? ` with status ${active.label.toLowerCase()}` : ""}.
          </EmptyState>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
                <th className="py-3 pl-5 pr-3 font-medium">Task</th>
                <th className="hidden py-3 pr-3 font-medium sm:table-cell">
                  Status
                </th>
                <th className="hidden py-3 pr-3 font-medium md:table-cell">
                  Workspace
                </th>
                <th className="hidden py-3 pr-3 font-medium lg:table-cell">
                  Repo
                </th>
                <th className="py-3 pr-5 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-[var(--color-line-soft)] transition-colors hover:bg-[var(--color-canvas)]"
                >
                  <td className="max-w-[380px] py-3 pl-5 pr-3">
                    <div className="truncate font-medium text-[var(--color-ink)]">
                      {t.title}
                    </div>
                    <Mono>{shortId(t.id)}</Mono>
                    <span className="ml-2 text-[11.5px] text-[var(--color-faint)]">
                      {t.node_type}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 sm:table-cell">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="hidden py-3 pr-3 md:table-cell">
                    <Link
                      href={`/workspaces/${t.workspace_slug}`}
                      className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      {t.workspace_slug}
                    </Link>
                  </td>
                  <td className="hidden max-w-[200px] truncate py-3 pr-3 text-[var(--color-muted)] lg:table-cell">
                    {t.repo ?? ""}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 text-right text-[12.5px] text-[var(--color-faint)]">
                    {relativeTime(t.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
