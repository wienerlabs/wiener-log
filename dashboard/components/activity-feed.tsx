import type { ActivityRow } from "@/lib/db";
import { SourcePill } from "@/components/ui";
import { relativeTime, shortDate } from "@/lib/utils";

function titleCase(s: string): string {
  const t = s.replace(/[._]/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="divide-y divide-[var(--color-line-soft)]">
      {rows.map((e) => {
        const detail = e.title || e.message || null;
        const short = e.repository ? e.repository.split("/").slice(-1)[0] : null;
        return (
          <div key={e.id} className="flex items-start gap-3 px-5 py-3.5">
            <div className="w-0 pt-0.5">
              <SourcePill source={e.source} />
            </div>
            <div className="min-w-0 flex-1 pl-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
                  {titleCase(e.kind)}
                </span>
                {e.action ? (
                  <span className="rounded-full bg-[var(--color-line-soft)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--color-muted)]">
                    {e.action}
                  </span>
                ) : null}
                {e.number ? (
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-faint)]">
                    #{e.number}
                  </span>
                ) : null}
              </div>
              {detail ? (
                <div className="mt-0.5 line-clamp-1 text-[12.5px] text-[var(--color-muted)]">
                  {detail}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-faint)]">
                {short ? <span>{short}</span> : null}
                {e.branch ? <span>{e.branch}</span> : null}
                {e.sha ? <span>{e.sha.slice(0, 7)}</span> : null}
              </div>
            </div>
            <span
              className="w-0 whitespace-nowrap pl-2 text-right text-[11.5px] text-[var(--color-faint)]"
              title={shortDate(e.ingested_at)}
            >
              {relativeTime(e.ingested_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
