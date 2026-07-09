"use client";

import { useState } from "react";
import type { GhPull } from "@/lib/db";
import { Card, PullRow, EmptyState } from "@/components/ui";
import { Segmented, SearchInput } from "@/components/controls";

export function PullsView({ pulls }: { pulls: GhPull[] }) {
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");

  const open = pulls.filter((p) => !p.draft);
  const draft = pulls.filter((p) => p.draft);

  const source =
    tab === "open" ? open : tab === "draft" ? draft : [];

  const needle = q.trim().toLowerCase();
  const filtered = source.filter((p) => {
    if (!needle) return true;
    return (
      p.title.toLowerCase().includes(needle) ||
      p.repo.toLowerCase().includes(needle) ||
      (p.author || "").toLowerCase().includes(needle)
    );
  });

  const notTracked = tab === "merged" || tab === "closed";

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "open", label: "Open", count: open.length },
            { key: "draft", label: "Draft", count: draft.length },
            { key: "merged", label: "Merged" },
            { key: "closed", label: "Closed" },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Find a pull request" />
      </div>

      {notTracked ? (
        <EmptyState>
          Merged and closed pull requests are not tracked in the live panel.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>No pull requests match this filter.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-line-soft)]">
            {filtered.map((p) => (
              <PullRow key={`${p.repo}#${p.number}`} pull={p} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
