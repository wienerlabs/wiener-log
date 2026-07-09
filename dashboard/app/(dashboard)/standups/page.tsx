import { getStandups } from "@/lib/db";
import { Card, PageHeader, EmptyState, Avatar } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StandupsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const standups = await getStandups(today);
  const label = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rise">
      <PageHeader
        title="Standups"
        subtitle={`Auto-written from everyone's activity · ${label}`}
      />

      {standups.length === 0 ? (
        <EmptyState>
          No standups yet today. They generate each morning from commits and
          Claude Code sessions — or run /standup in chat to make yours now.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {standups.map((s) => (
            <Card key={s.handle} className="p-5">
              <Link
                href={`/members/${s.handle}`}
                className="mb-3 inline-flex items-center gap-2.5"
              >
                <Avatar handle={s.handle} src={s.avatar_url} size={30} />
                <span className="text-[14px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                  {s.handle}
                </span>
              </Link>
              <div className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[var(--color-ink-soft)]">
                {s.summary}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
