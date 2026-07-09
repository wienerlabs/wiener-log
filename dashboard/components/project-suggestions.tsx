"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ProjectSuggestion } from "@/lib/db";
import {
  acceptSuggestion,
  dismissSuggestion,
} from "@/lib/project-suggestion-actions";
import { Card, SectionHeader, LanguageDot, Avatar } from "@/components/ui";
import { Sparkles, Check, X } from "lucide-react";

export type SuggestionGroup = {
  name: string;
  full_name: string;
  language: string | null;
  suggestions: ProjectSuggestion[];
};

function ProjectPanel({ group }: { group: SuggestionGroup }) {
  const [items, setItems] = useState(group.suggestions);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = (id: number) => {
    setItems((p) => p.filter((s) => s.id !== id));
    start(async () => {
      const r = await acceptSuggestion(id);
      if (!r.ok) setError(r.error || "Failed");
    });
  };
  const dismiss = (id: number) => {
    setItems((p) => p.filter((s) => s.id !== id));
    start(async () => {
      await dismissSuggestion(id);
    });
  };

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <LanguageDot language={group.language} withLabel={false} />
        <Link
          href={`/projects/${group.name}`}
          className="truncate text-[13.5px] font-semibold text-[var(--color-accent)] transition-opacity hover:opacity-70"
        >
          {group.name}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[var(--color-faint)]">
          No open suggestions.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((s) => (
            <div
              key={s.id}
              className="rounded-[10px] bg-[var(--color-canvas)] p-3 ring-1 ring-[var(--color-ring)]"
            >
              <div className="text-[12.5px] font-medium text-[var(--color-ink)]">
                {s.title}
              </div>
              {s.body ? (
                <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-[1.45] text-[var(--color-muted)]">
                  {s.body}
                </p>
              ) : null}
              {s.suggested_assignee ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                  <Avatar handle={s.suggested_assignee} size={16} />
                  <span>for @{s.suggested_assignee}</span>
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => accept(s.id)}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--color-btn)] px-2 py-1 text-[11px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <Check className="size-[12px]" strokeWidth={2.5} />
                  {s.suggested_assignee ? "Assign & open" : "Open issue"}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(s.id)}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] ring-1 ring-[var(--color-ring)] transition-colors hover:text-[var(--color-danger)]"
                >
                  <X className="size-[12px]" strokeWidth={2} />
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error ? (
        <p className="mt-2 text-[11px] text-[var(--color-danger)]">{error}</p>
      ) : null}
    </Card>
  );
}

export function ProjectSuggestions({ groups }: { groups: SuggestionGroup[] }) {
  const total = groups.reduce((a, g) => a + g.suggestions.length, 0);
  return (
    <div>
      <SectionHeader
        title="Task suggestions"
        action={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-[13px] text-[var(--color-accent)]" strokeWidth={2} />
            {total ? `${total} across top projects` : "top active projects"}
          </span>
        }
      />
      {groups.length === 0 ? (
        <Card className="px-5 py-8 text-center text-[13px] text-[var(--color-faint)]">
          No active projects yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {groups.map((g) => (
            <ProjectPanel key={g.full_name} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
