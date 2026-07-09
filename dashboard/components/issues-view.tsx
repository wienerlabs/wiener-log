"use client";

import { useState } from "react";
import type { GhIssue, PriorityCount } from "@/lib/db";
import { Card, IssueRow, EmptyState, priorityMeta } from "@/components/ui";
import { SearchInput } from "@/components/controls";
import { cn } from "@/lib/utils";

export function IssuesView({
  issues,
  counts,
}: {
  issues: GhIssue[];
  counts: PriorityCount[];
}) {
  const [priority, setPriority] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = issues.filter((i) => {
    if (priority && i.priority !== priority) return false;
    if (!needle) return true;
    return (
      i.title.toLowerCase().includes(needle) ||
      i.repo.toLowerCase().includes(needle) ||
      (i.author || "").toLowerCase().includes(needle) ||
      i.labels.some((l) => l.name.toLowerCase().includes(needle))
    );
  });

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => {
          const meta = priorityMeta(c.priority);
          const active = priority === c.priority;
          return (
            <button
              key={c.priority}
              type="button"
              onClick={() => setPriority(active ? null : c.priority)}
              className={cn(
                "rounded-[16px] bg-[var(--color-surface)] p-4 text-left ring-1 transition-all",
                active
                  ? "ring-[var(--color-accent)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.18)]"
                  : "ring-[var(--color-ring)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.16)]",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-[8px] rounded-full"
                  style={{ backgroundColor: meta.dot }}
                />
                <span className="text-[12.5px] font-medium text-[var(--color-muted)]">
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 text-[26px] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
                {c.count}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-[var(--color-muted)]">
          {priority ? `Filtered to ${priorityMeta(priority).label}` : "All open issues"}
          {priority ? (
            <button
              type="button"
              onClick={() => setPriority(null)}
              className="ml-2 text-[var(--color-accent)] transition-opacity hover:opacity-70"
            >
              Clear
            </button>
          ) : null}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Find an issue" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>No issues match this filter.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-line-soft)]">
            {filtered.map((i) => (
              <IssueRow key={`${i.repo}#${i.number}`} issue={i} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
