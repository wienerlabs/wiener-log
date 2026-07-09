import type { StalePull, UnassignedIssue } from "@/lib/digest";
import { Card, SectionHeader, priorityMeta } from "@/components/ui";
import { relativeTime } from "@/lib/utils";
import { GitPullRequestArrow, CircleDot } from "lucide-react";

function repoShort(repo: string): string {
  return repo.split("/").pop() || repo;
}

export function NeedsAttention({
  stalePulls,
  unassigned,
}: {
  stalePulls: StalePull[];
  unassigned: UnassignedIssue[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <SectionHeader
          title="Stale pull requests"
          action={<span>{stalePulls.length} open over 7 days</span>}
        />
        <Card className="overflow-hidden">
          {stalePulls.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[var(--color-faint)]">
              Nothing stale. Nice.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line-soft)]">
              {stalePulls.slice(0, 8).map((p) => (
                <a
                  key={`${p.repo}#${p.number}`}
                  href={p.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                >
                  <GitPullRequestArrow
                    className="mt-0.5 size-[15px] shrink-0 text-[var(--color-warn)]"
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                      {p.title}
                    </div>
                    <div className="text-[11.5px] text-[var(--color-faint)]">
                      {repoShort(p.repo)} #{p.number} · opened {relativeTime(p.created_at)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <SectionHeader
          title="Unassigned criticals"
          action={<span>{unassigned.length} need an owner</span>}
        />
        <Card className="overflow-hidden">
          {unassigned.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[var(--color-faint)]">
              Every critical issue has an owner.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line-soft)]">
              {unassigned.slice(0, 8).map((i) => {
                const meta = priorityMeta(i.priority);
                return (
                  <a
                    key={`${i.repo}#${i.number}`}
                    href={i.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-line-soft)]"
                  >
                    <CircleDot
                      className="mt-0.5 size-[15px] shrink-0"
                      style={{ color: meta.dot }}
                      strokeWidth={2}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                        {i.title}
                      </div>
                      <div className="text-[11.5px] text-[var(--color-faint)]">
                        {repoShort(i.repo)} #{i.number} · {meta.label} · opened{" "}
                        {relativeTime(i.created_at)}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
