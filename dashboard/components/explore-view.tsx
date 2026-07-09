"use client";

import { useState } from "react";
import Link from "next/link";
import type { GhRepo, TopicStat, MemberRow } from "@/lib/db";
import {
  Card,
  Avatar,
  OrgBadge,
  LanguageDot,
  EmptyState,
} from "@/components/ui";
import { Segmented } from "@/components/controls";
import { formatNumber, relativeTime } from "@/lib/utils";
import { Star } from "lucide-react";

export function ExploreView({
  trending,
  topics,
  people,
  initialTopic = "",
}: {
  trending: GhRepo[];
  topics: TopicStat[];
  people: MemberRow[];
  initialTopic?: string;
}) {
  const [tab, setTab] = useState(initialTopic ? "topics" : "trending");
  const [topic, setTopic] = useState(initialTopic);

  const shown = topic
    ? trending.filter((r) => r.topics.includes(topic))
    : trending;

  return (
    <div>
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0b1220] via-[#111a2e] to-[#0071e3] px-7 py-8 text-white">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-white/60">
            Explore
          </div>
          <h2 className="mt-1.5 max-w-[520px] text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">
            Discover what Wiener Labs is building across every org.
          </h2>
          <div className="mt-4 flex flex-wrap gap-5 text-[13px] text-white/75">
            <span>
              <span className="font-semibold text-white">{trending.length}</span>{" "}
              trending
            </span>
            <span>
              <span className="font-semibold text-white">{topics.length}</span>{" "}
              topics
            </span>
            <span>
              <span className="font-semibold text-white">{people.length}</span>{" "}
              people
            </span>
          </div>
        </div>
      </Card>

      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={(k) => {
            setTab(k);
            if (k !== "topics") setTopic("");
          }}
          options={[
            { key: "trending", label: "Trending" },
            { key: "topics", label: "Topics", count: topics.length },
            { key: "people", label: "People", count: people.length },
          ]}
        />
      </div>

      {tab === "trending" ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-line-soft)]">
            {shown.map((r, i) => (
              <a
                key={r.full_name}
                href={r.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-line-soft)]"
              >
                <span className="w-6 text-center text-[15px] font-semibold tabular-nums text-[var(--color-faint)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[var(--color-accent)]">
                    {r.full_name}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[12.5px] text-[var(--color-muted)]">
                    {r.description || "No description provided."}
                  </div>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  {r.language ? (
                    <LanguageDot language={r.language} />
                  ) : null}
                  {r.stars > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted)]">
                      <Star className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
                      {formatNumber(r.stars)}
                    </span>
                  ) : null}
                  <span className="w-[64px] text-right text-[11.5px] text-[var(--color-faint)]">
                    {relativeTime(r.pushed_at)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "topics" ? (
        <div className="flex flex-wrap gap-2">
          {topic ? (
            <button
              type="button"
              onClick={() => setTopic("")}
              className="rounded-full bg-[var(--color-btn)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-btn-fg)]"
            >
              {topic} · clear
            </button>
          ) : null}
          {topics.map((t) => (
            <button
              key={t.topic}
              type="button"
              onClick={() => {
                setTopic(t.topic);
                setTab("trending");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-all hover:-translate-y-0.5 hover:text-[var(--color-accent)] hover:ring-[var(--color-accent)]/30"
            >
              {t.topic}
              <span className="rounded-full bg-[var(--color-line-soft)] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[var(--color-faint)]">
                {t.repos}
              </span>
            </button>
          ))}
          {topics.length === 0 ? (
            <EmptyState>No topics tagged yet.</EmptyState>
          ) : null}
        </div>
      ) : null}

      {tab === "people" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((m) => (
            <Link key={m.handle} href={`/members/${m.handle}`}>
              <Card className="flex items-center gap-3 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                <Avatar handle={m.handle} src={m.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
                    {m.handle}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.orgs.map((o) => (
                      <OrgBadge key={o} org={o} />
                    ))}
                  </div>
                </div>
                <span className="text-[12px] tabular-nums text-[var(--color-faint)]">
                  {formatNumber(m.events)}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
