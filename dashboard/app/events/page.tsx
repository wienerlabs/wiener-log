import { getRecentEvents, type EventSource } from "@/lib/db";
import { relativeTime } from "@/lib/utils";
import {
  Card,
  PageHeader,
  SourcePill,
  EmptyState,
} from "@/components/ui";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const filters: { key: string; label: string; source?: EventSource }[] = [
  { key: "all", label: "All" },
  { key: "github", label: "GitHub", source: "github" },
  { key: "git", label: "Git", source: "git" },
  { key: "claude_code", label: "Claude Code", source: "claude_code" },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const active = filters.find((f) => f.key === source) ?? filters[0];
  const events = await getRecentEvents(120, { source: active.source });

  return (
    <div className="rise">
      <PageHeader
        title="Events"
        subtitle="The raw firehose: git, Claude Code, and GitHub activity."
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/events" : `/events?source=${f.key}`}
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
        {events.length === 0 ? (
          <EmptyState>No events for this filter.</EmptyState>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {events.map((e, i) => (
                <tr
                  key={e.id}
                  className={cn(
                    "transition-colors hover:bg-[var(--color-canvas)]",
                    i === 0 ? "" : "border-t border-[var(--color-line-soft)]",
                  )}
                >
                  <td className="w-0 whitespace-nowrap py-3 pl-5 pr-3">
                    <SourcePill source={e.source} />
                  </td>
                  <td className="py-3 pr-3 font-medium text-[var(--color-ink)]">
                    {e.kind}
                  </td>
                  <td className="hidden max-w-[280px] truncate py-3 pr-3 text-[var(--color-muted)] sm:table-cell">
                    {e.label ?? ""}
                  </td>
                  <td className="hidden py-3 pr-3 md:table-cell">
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
  );
}
