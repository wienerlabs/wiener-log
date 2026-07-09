import { getTeamTimeReport } from "@/lib/time";
import { isAdmin } from "@/lib/session";
import {
  Card,
  StatCard,
  PageHeader,
  SectionHeader,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { formatMinutes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="rise">
        <PageHeader title="Reports" />
        <EmptyState>Only admins can view team reports.</EmptyState>
      </div>
    );
  }
  const { days: daysRaw } = await searchParams;
  const days = daysRaw === "30" ? 30 : 7;
  const report = await getTeamTimeReport(days);

  const maxDay = Math.max(1, ...report.perDay.map((d) => d.minutes));
  const avg =
    report.activeMembers > 0 ? report.totalMinutes / report.activeMembers : 0;

  return (
    <div className="rise">
      <PageHeader
        title="Reports"
        subtitle="Effort tracked automatically from git and Claude Code activity."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[12px] bg-[var(--color-line-soft)] p-1">
          {[7, 30].map((d) => (
            <Link
              key={d}
              href={`/reports?days=${d}`}
              className={cn(
                "rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition-all",
                days === d
                  ? "bg-[var(--color-raised)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink-soft)]",
              )}
            >
              Last {d} days
            </Link>
          ))}
        </div>
        <a
          href={`/api/reports/export?days=${days}`}
          className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
        >
          <Download className="size-4" strokeWidth={2} /> Export CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tracked" value={formatMinutes(report.totalMinutes)} accent />
        <StatCard label="Active members" value={String(report.activeMembers)} />
        <StatCard label="Projects" value={String(report.perProject.length)} />
        <StatCard label="Avg / member" value={formatMinutes(avg)} />
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Daily activity"
          action={<span>Last {days} days</span>}
        />
        <Card className="p-5">
          <div className="flex h-32 items-end gap-1.5">
            {report.perDay.map((d) => (
              <div
                key={d.date}
                className="group relative flex-1"
                title={`${d.date} · ${formatMinutes(d.minutes)}`}
              >
                <div
                  className="w-full rounded-[3px] bg-[var(--color-accent)]/30 transition-all group-hover:bg-[var(--color-accent)]/60"
                  style={{ height: `${Math.max(3, (d.minutes / maxDay) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="By member" action={<span>{report.perMember.length}</span>} />
          <Card className="overflow-hidden">
            {report.perMember.length === 0 ? (
              <EmptyState>No tracked activity yet. It fills as the team onboards.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {report.perMember.map((m, i) => (
                    <tr
                      key={m.handle}
                      className={i === 0 ? "" : "border-t border-[var(--color-line-soft)]"}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <Link
                          href={`/members/${m.handle}`}
                          className="inline-flex items-center gap-2.5"
                        >
                          <Avatar handle={m.handle} size={26} />
                          <span className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                            {m.handle}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-right text-[12px] text-[var(--color-faint)]">
                        {m.events} events
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-right font-semibold tabular-nums text-[var(--color-ink)]">
                        {formatMinutes(m.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader title="By project" action={<span>{report.perProject.length}</span>} />
          <Card className="overflow-hidden">
            {report.perProject.length === 0 ? (
              <EmptyState>No project time attributed yet.</EmptyState>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {report.perProject.slice(0, 12).map((p, i) => (
                    <tr
                      key={p.repo}
                      className={i === 0 ? "" : "border-t border-[var(--color-line-soft)]"}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <a
                          href={`https://github.com/${p.repo}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                        >
                          {p.repo.split("/").pop()}
                        </a>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-right font-semibold tabular-nums text-[var(--color-ink)]">
                        {formatMinutes(p.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
