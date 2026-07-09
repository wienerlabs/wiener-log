import { getMembers, getOrgs, getTeamPresence } from "@/lib/db";
import { relativeTime, cn } from "@/lib/utils";
import {
  Card,
  PageHeader,
  SectionHeader,
  EmptyState,
  Avatar,
  OrgBadge,
} from "@/components/ui";
import { TeamPresence } from "@/components/team-presence";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const [orgs, members, presence] = await Promise.all([
    getOrgs(),
    getMembers(org),
    getTeamPresence(),
  ]);

  const tabs = [
    { org: "All members", key: undefined as string | undefined },
  ].concat(orgs.map((o) => ({ org: o.org, key: o.org })));

  return (
    <div className="rise">
      <PageHeader
        title="Members"
        subtitle="GitHub org members. Click anyone to view their work and assign tasks."
      />

      <div className="mb-8">
        <SectionHeader title="Team presence" />
        <TeamPresence rows={presence} />
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = (t.key ?? "") === (org ?? "");
          return (
            <Link
              key={t.org}
              href={
                t.key ? `/members?org=${encodeURIComponent(t.key)}` : "/members"
              }
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-[var(--color-btn)] text-[var(--color-btn-fg)]"
                  : "bg-[var(--color-surface)] text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] hover:bg-[var(--color-line-soft)]",
              )}
            >
              {t.org}
            </Link>
          );
        })}
      </div>

      {members.length === 0 ? (
        <EmptyState>No members for this org.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <Link key={m.handle} href={`/members/${m.handle}`} className="group">
              <Card className="p-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <Avatar handle={m.handle} src={m.avatar_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                      {m.handle}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.orgs.map((o) => (
                        <OrgBadge key={o} org={o} />
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-[var(--color-faint)] transition-colors group-hover:text-[var(--color-accent)]" />
                </div>
                <div className="mt-4 flex items-center gap-4 text-[12px] text-[var(--color-muted)]">
                  <span>
                    <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                      {m.events}
                    </span>{" "}
                    events
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                      {m.tasks}
                    </span>{" "}
                    tasks
                  </span>
                  {m.created_at ? (
                    <span className="ml-auto text-[var(--color-faint)]">
                      {relativeTime(m.created_at)}
                    </span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
