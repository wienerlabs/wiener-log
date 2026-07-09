"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResults } from "@/lib/db";
import { Search, FolderGit2, GitPullRequestArrow, CircleDot, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  primary: string;
  secondary: string;
  go: () => void;
  Icon: typeof Search;
};

const empty: SearchResults = { repos: [], pulls: [], issues: [], members: [] };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(empty);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wlog:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wlog:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else {
      setQ("");
      setResults(empty);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults(empty);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (res.ok) setResults(await res.json());
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(id);
  }, [q, open]);

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const external = (url: string) => window.open(url, "_blank", "noopener");

  const items: Item[] = [
    ...results.repos.map((r) => ({
      key: `r-${r.full_name}`,
      primary: r.name,
      secondary: r.full_name,
      go: () => go(() => external(r.html_url)),
      Icon: FolderGit2,
    })),
    ...results.pulls.map((p) => ({
      key: `p-${p.repo}-${p.number}`,
      primary: p.title,
      secondary: `${p.repo.split("/").pop()} #${p.number}`,
      go: () => go(() => external(p.html_url)),
      Icon: GitPullRequestArrow,
    })),
    ...results.issues.map((i) => ({
      key: `i-${i.repo}-${i.number}`,
      primary: i.title,
      secondary: `${i.repo.split("/").pop()} #${i.number} · ${i.priority}`,
      go: () => go(() => external(i.html_url)),
      Icon: CircleDot,
    })),
    ...results.members.map((m) => ({
      key: `m-${m.handle}`,
      primary: m.handle,
      secondary: "Member",
      go: () => go(() => router.push(`/members/${m.handle}`)),
      Icon: Users,
    })),
  ];

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [items.length, active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.go();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[16px] bg-[var(--color-surface)] ring-1 ring-[var(--color-ring)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] px-4">
          <Search className="size-[18px] text-[var(--color-faint)]" strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search repos, pull requests, issues, people…"
            className="w-full bg-transparent py-3.5 text-[14.5px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
          />
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--color-faint)]">
              {q.trim().length < 2 ? "Type to search across the org." : "No matches."}
            </div>
          ) : (
            items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={it.go}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === active ? "bg-[var(--color-line-soft)]" : "",
                )}
              >
                <it.Icon className="size-[16px] shrink-0 text-[var(--color-faint)]" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                    {it.primary}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--color-faint)]">
                    {it.secondary}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
