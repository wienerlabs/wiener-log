"use client";

import { useMemo, useState } from "react";
import type { GhRepo } from "@/lib/db";
import { RepoCard, EmptyState } from "@/components/ui";
import { Segmented, SearchInput } from "@/components/controls";

export function ReposView({
  repos,
  pinnedNames,
  initialQuery = "",
}: {
  repos: GhRepo[];
  pinnedNames: string[];
  initialQuery?: string;
}) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState(initialQuery);
  const pinnedSet = useMemo(() => new Set(pinnedNames), [pinnedNames]);

  const active = repos.filter((r) => !r.is_archived);

  const counts = {
    all: active.length,
    pinned: active.filter((r) => pinnedSet.has(r.full_name)).length,
    public: active.filter((r) => !r.is_private).length,
    private: active.filter((r) => r.is_private).length,
    archived: repos.filter((r) => r.is_archived).length,
  };

  const byTab = (r: GhRepo) => {
    if (tab === "archived") return r.is_archived;
    if (r.is_archived) return false;
    if (tab === "pinned") return pinnedSet.has(r.full_name);
    if (tab === "public") return !r.is_private;
    if (tab === "private") return r.is_private;
    return true;
  };

  const needle = q.trim().toLowerCase();
  const filtered = repos.filter((r) => {
    if (!byTab(r)) return false;
    if (!needle) return true;
    return (
      r.name.toLowerCase().includes(needle) ||
      (r.description || "").toLowerCase().includes(needle) ||
      r.topics.some((t) => t.toLowerCase().includes(needle)) ||
      (r.language || "").toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "pinned", label: "Pinned", count: counts.pinned },
            { key: "public", label: "Public", count: counts.public },
            { key: "private", label: "Private", count: counts.private },
            { key: "archived", label: "Archived", count: counts.archived },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Find a repository" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>No repositories match this filter.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RepoCard key={r.full_name} repo={r} />
          ))}
        </div>
      )}
    </div>
  );
}
