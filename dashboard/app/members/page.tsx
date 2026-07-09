import { getMembers } from "@/lib/db";
import { relativeTime } from "@/lib/utils";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="rise">
      <PageHeader
        title="Members"
        subtitle="Org members mirrored from GitHub into workspaces."
      />

      <Card className="overflow-hidden">
        {members.length === 0 ? (
          <EmptyState>No members synced yet.</EmptyState>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
                <th className="py-3 pl-5 pr-3 font-medium">Member</th>
                <th className="hidden py-3 pr-3 font-medium sm:table-cell">
                  Workspace
                </th>
                <th className="hidden py-3 pr-3 font-medium md:table-cell">
                  Email
                </th>
                <th className="py-3 pr-3 text-right font-medium">Tasks</th>
                <th className="py-3 pr-5 text-right font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={`${m.workspace_slug}-${m.handle}`}
                  className="border-t border-[var(--color-line-soft)] transition-colors hover:bg-[var(--color-canvas)]"
                >
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-line-soft)] text-[12px] font-semibold text-[var(--color-ink-soft)]">
                        {m.handle.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-[var(--color-ink)]">
                        {m.handle}
                      </span>
                    </div>
                  </td>
                  <td className="hidden py-3 pr-3 sm:table-cell">
                    <Link
                      href={`/workspaces/${m.workspace_slug}`}
                      className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      {m.workspace_slug}
                    </Link>
                  </td>
                  <td className="hidden py-3 pr-3 text-[var(--color-muted)] md:table-cell">
                    {m.email ?? ""}
                  </td>
                  <td className="py-3 pr-3 text-right font-semibold tabular-nums text-[var(--color-ink)]">
                    {m.tasks}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 text-right text-[12.5px] text-[var(--color-faint)]">
                    {relativeTime(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
