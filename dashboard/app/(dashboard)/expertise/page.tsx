import { getRepoOwnership } from "@/lib/db";
import {
  Card,
  PageHeader,
  SectionHeader,
  Avatar,
  LanguageDot,
  EmptyState,
} from "@/components/ui";
import { TriangleAlert, Star } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ExpertisePage() {
  const ownership = await getRepoOwnership();
  const busFactor = ownership
    .filter((o) => o.count <= 2 && o.total >= 3)
    .slice(0, 12);

  return (
    <div className="rise">
      <PageHeader
        title="Expertise"
        subtitle="Who owns what across the org, and where the bus factor is thin."
      />

      {busFactor.length ? (
        <div className="mb-8">
          <SectionHeader
            title="Bus factor risk"
            action={<span>{busFactor.length} at risk</span>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {busFactor.map((o) => (
              <Card key={o.repo} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/projects/${o.name}`}
                    className="truncate text-[13.5px] font-semibold text-[var(--color-ink)] transition-opacity hover:opacity-70"
                  >
                    {o.name}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${o.count === 1 ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : "bg-[var(--color-warn-soft)] text-[var(--color-warn)]"}`}
                  >
                    {o.count === 1 ? "1 owner" : "2 owners"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Avatar handle={o.primary} src={o.contributors[0]?.avatar} size={26} />
                  <span className="text-[12.5px] text-[var(--color-muted)]">
                    @{o.primary}
                  </span>
                  {o.language ? (
                    <span className="ml-auto">
                      <LanguageDot language={o.language} />
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <SectionHeader
        title="Ownership by repository"
        action={<span>{ownership.length} repositories</span>}
      />
      {ownership.length === 0 ? (
        <EmptyState>No ownership signal yet.</EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {ownership.slice(0, 40).map((o) => (
            <Card key={o.repo} className="p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${o.name}`}
                      className="truncate text-[13.5px] font-semibold text-[var(--color-ink)] transition-opacity hover:opacity-70"
                    >
                      {o.name}
                    </Link>
                    {o.language ? <LanguageDot language={o.language} /> : null}
                    {o.count <= 2 ? (
                      <TriangleAlert
                        className="size-[13px] text-[var(--color-warn)]"
                        strokeWidth={2.2}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--color-faint)]">
                    Primary @{o.primary} · {Math.round((o.contributors[0]?.share ?? 0) * 100)}% · {o.count} contributor{o.count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex shrink-0 -space-x-2">
                  {o.contributors.slice(0, 6).map((c, i) => (
                    <div
                      key={c.handle}
                      className="relative rounded-full ring-2 ring-[var(--color-surface)]"
                      title={`@${c.handle} · ${c.contributions}`}
                    >
                      <Avatar handle={c.handle} src={c.avatar} size={26} />
                      {i === 0 ? (
                        <Star
                          className="absolute -right-0.5 -top-0.5 size-[11px] fill-[var(--color-accent)] text-[var(--color-accent)]"
                          strokeWidth={2}
                        />
                      ) : null}
                    </div>
                  ))}
                  {o.count > 6 ? (
                    <div className="flex size-[26px] items-center justify-center rounded-full bg-[var(--color-line-soft)] text-[10px] font-semibold text-[var(--color-muted)] ring-2 ring-[var(--color-surface)]">
                      +{o.count - 6}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
