import { getRepos } from "@/lib/db";
import { relativeTime, formatNumber } from "@/lib/utils";
import { Card, PageHeader, EmptyState, GithubMark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const repos = await getRepos();
  const totalEvents = repos.reduce((a, r) => a + r.events, 0);

  return (
    <div className="rise">
      <PageHeader
        title="Repositories"
        subtitle={`${repos.length} repos sending webhooks · ${formatNumber(totalEvents)} events observed.`}
      />

      {repos.length === 0 ? (
        <EmptyState>No repository events yet.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
                <th className="py-3 pl-5 pr-3 font-medium">Repository</th>
                <th className="py-3 pr-3 text-right font-medium">Events</th>
                <th className="py-3 pr-5 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((r) => (
                <tr
                  key={r.repo}
                  className="border-t border-[var(--color-line-soft)] transition-colors hover:bg-[var(--color-canvas)]"
                >
                  <td className="py-3 pl-5 pr-3">
                    <a
                      href={`https://github.com/${r.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 font-medium text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      <GithubMark className="size-3.5 text-[var(--color-faint)]" />
                      {r.repo}
                    </a>
                  </td>
                  <td className="py-3 pr-3 text-right font-semibold tabular-nums text-[var(--color-ink)]">
                    {formatNumber(r.events)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 text-right text-[12.5px] text-[var(--color-faint)]">
                    {relativeTime(r.last_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
