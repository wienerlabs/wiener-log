import { getWorkspaces } from "@/lib/db";
import { relativeTime } from "@/lib/utils";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const workspaces = await getWorkspaces();

  return (
    <div className="rise">
      <PageHeader
        title="Workspaces"
        subtitle="One per org member. Activity aggregates here."
      />

      {workspaces.length === 0 ? (
        <EmptyState>No workspaces yet. Run member sync.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <Link key={w.id} href={`/workspaces/${w.slug}`} className="group">
              <Card className="p-5 transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                      {w.name}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--color-faint)]">
                      /{w.slug}
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 text-[var(--color-faint)] transition-colors group-hover:text-[var(--color-accent)]" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Metric value={w.events} label="events" />
                  <Metric value={w.tasks} label="tasks" />
                  <Metric value={w.members} label="members" />
                </div>
                <div className="mt-4 text-[11.5px] text-[var(--color-faint)]">
                  created {relativeTime(w.created_at)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[12px] bg-[var(--color-line-soft)] px-3 py-2.5">
      <div className="text-[19px] font-semibold tabular-nums leading-none text-[var(--color-ink)]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-muted)]">{label}</div>
    </div>
  );
}
