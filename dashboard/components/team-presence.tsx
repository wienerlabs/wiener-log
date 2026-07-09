import type { PresenceRow } from "@/lib/db";
import { Card, Avatar } from "@/components/ui";
import Link from "next/link";

const STATUS: Record<string, { label: string; dot: string }> = {
  available: { label: "Available", dot: "#3fb950" },
  focus: { label: "Focused", dot: "#a371f7" },
  away: { label: "Away", dot: "#d29922" },
  ooo: { label: "Out of office", dot: "#8b949e" },
};

export function TeamPresence({ rows }: { rows: PresenceRow[] }) {
  const now = Date.now();
  const enriched = rows.map((r) => {
    const online = r.last_seen && now - new Date(r.last_seen).getTime() < 120000;
    return { ...r, online: !!online, inCall: r.in_call > 0 };
  });
  enriched.sort((a, b) => {
    const rank = (x: (typeof enriched)[number]) =>
      x.inCall ? 0 : x.online ? 1 : 2;
    return rank(a) - rank(b);
  });
  const onlineCount = enriched.filter((e) => e.online || e.inCall).length;

  return (
    <Card className="p-5">
      <div className="mb-3 text-[12.5px] text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-ink)]">
          {onlineCount}
        </span>{" "}
        online now
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {enriched.map((r) => {
          const meta = STATUS[r.status || "available"] || STATUS.available;
          return (
            <Link
              key={r.handle}
              href={`/members/${r.handle}`}
              className="flex items-center gap-2.5"
            >
              <div className="relative">
                <Avatar handle={r.handle} src={r.avatar_url} size={30} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-[11px] rounded-full ring-2 ring-[var(--color-surface)]"
                  style={{
                    backgroundColor: r.online || r.inCall ? "#3fb950" : "#6e7681",
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                  {r.handle}
                </div>
                <div className="truncate text-[11px] text-[var(--color-faint)]">
                  {r.inCall ? (
                    <span className="text-[var(--color-ok)]">In a call</span>
                  ) : r.status && r.status !== "available" ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block size-[6px] rounded-full"
                        style={{ backgroundColor: meta.dot }}
                      />
                      {r.message || meta.label}
                    </span>
                  ) : r.online ? (
                    "Online"
                  ) : (
                    "Offline"
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
