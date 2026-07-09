"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, EmptyState, LanguageDot, Avatar } from "@/components/ui";
import { Segmented, SearchInput } from "@/components/controls";
import { relativeTime } from "@/lib/utils";
import { GitPullRequestArrow, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export type Project = {
  full_name: string;
  name: string;
  org: string;
  description: string | null;
  language: string | null;
  topics: string[];
  html_url: string;
  pushed_at: string;
  status: "active" | "idle" | "dormant";
  open_pulls: number;
  open_issues: number;
  contributors: { handle: string; avatar: string | null }[];
};

const statusMeta: Record<string, { label: string; c: string; dot: string }> = {
  active: { label: "Active", c: "text-[var(--color-ok)]", dot: "#1a7f45" },
  idle: { label: "Idle", c: "text-[var(--color-warn)]", dot: "#9a6a00" },
  dormant: { label: "Dormant", c: "text-[var(--color-faint)]", dot: "#a1a1aa" },
};

function StatusPill({ status }: { status: Project["status"] }) {
  const s = statusMeta[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", s.c)}>
      <span className="inline-block size-[7px] rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

export function ProjectsView({ projects }: { projects: Project[] }) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const counts = {
    all: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    idle: projects.filter((p) => p.status === "idle").length,
    dormant: projects.filter((p) => p.status === "dormant").length,
  };

  const needle = q.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (tab !== "all" && p.status !== tab) return false;
    if (!needle) return true;
    return (
      p.name.toLowerCase().includes(needle) ||
      (p.description || "").toLowerCase().includes(needle) ||
      p.topics.some((t) => t.toLowerCase().includes(needle)) ||
      (p.language || "").toLowerCase().includes(needle)
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
            { key: "active", label: "Active", count: counts.active },
            { key: "idle", label: "Idle", count: counts.idle },
            { key: "dormant", label: "Dormant", count: counts.dormant },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Find a project" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>No projects match this filter.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((p) => (
            <Link
              key={p.full_name}
              href={`/projects/${p.name}`}
              className="block"
            >
            <Card className="flex h-full flex-col p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={p.html_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-accent)] transition-opacity hover:opacity-70"
                >
                  {p.name}
                </a>
                <StatusPill status={p.status} />
              </div>

              <p className="mt-2 line-clamp-2 min-h-[38px] text-[13px] leading-[1.45] text-[var(--color-muted)]">
                {p.description || "No description provided."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)]">
                  <GitPullRequestArrow className="size-[14px] text-[var(--color-faint)]" strokeWidth={2} />
                  {p.open_pulls} open
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)]">
                  <CircleDot className="size-[14px] text-[var(--color-faint)]" strokeWidth={2} />
                  {p.open_issues} open
                </span>
                {p.language ? <LanguageDot language={p.language} /> : null}
              </div>

              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="flex items-center">
                  {p.contributors.slice(0, 5).map((c, i) => (
                    <span
                      key={c.handle}
                      className={i === 0 ? "" : "-ml-2"}
                      style={{ zIndex: 5 - i }}
                    >
                      <Avatar handle={c.handle} src={c.avatar} size={24} />
                    </span>
                  ))}
                  {p.contributors.length > 5 ? (
                    <span className="ml-1.5 text-[11.5px] text-[var(--color-faint)]">
                      +{p.contributors.length - 5}
                    </span>
                  ) : null}
                  {p.contributors.length === 0 ? (
                    <span className="text-[11.5px] text-[var(--color-faint)]">
                      No recent contributors
                    </span>
                  ) : null}
                </div>
                <span className="text-[11.5px] text-[var(--color-faint)]">
                  {relativeTime(p.pushed_at)}
                </span>
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
