"use client";

import { useState, useTransition } from "react";
import type { ProposedTask } from "@/lib/db";
import { reviewOwnTask } from "@/lib/employee-actions";
import { Card, SectionHeader } from "@/components/ui";
import { relativeTime } from "@/lib/utils";
import { Sparkles, Check, X } from "lucide-react";

export function MySuggestions({ tasks }: { tasks: ProposedTask[] }) {
  const [items, setItems] = useState(tasks);
  const [, start] = useTransition();

  const review = (id: string, decision: "acked" | "rejected") => {
    setItems((p) => p.filter((t) => t.id !== id));
    start(async () => {
      await reviewOwnTask(id, decision);
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <SectionHeader
        title="Suggested for you"
        action={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-[13px] text-[var(--color-accent)]" strokeWidth={2} />
            {items.length} from your activity
          </span>
        }
      />
      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--color-line-soft)]">
          {items.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-[var(--color-ink)]">
                  {t.title}
                </div>
                {t.body ? (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.45] text-[var(--color-muted)]">
                    {t.body}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-[var(--color-faint)]">
                  {t.repo ? (
                    <span className="font-[family-name:var(--font-mono)]">
                      {t.repo}
                    </span>
                  ) : null}
                  <span>proposed {relativeTime(t.created_at)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => review(t.id, "acked")}
                  className="inline-flex items-center gap-1 rounded-[9px] bg-[var(--color-btn)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <Check className="size-[13px]" strokeWidth={2.5} />
                  Add to my tasks
                </button>
                <button
                  type="button"
                  onClick={() => review(t.id, "rejected")}
                  title="Dismiss"
                  className="inline-flex size-[30px] items-center justify-center rounded-[9px] bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)] hover:text-[var(--color-danger)]"
                >
                  <X className="size-[15px]" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
