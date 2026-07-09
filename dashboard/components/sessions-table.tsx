import type { SessionRow } from "@/lib/db";
import { Avatar, EmptyState } from "@/components/ui";
import { relativeTime, shortDate } from "@/lib/utils";

const ACTIVE_WINDOW_MS = 150_000;

function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  let os = "";
  if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

export function SessionsTable({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No sign-ins recorded yet.</EmptyState>;
  }

  const now = Date.now();

  return (
    <table className="w-full text-[13px]">
      <tbody>
        {rows.map((s, i) => {
          const seen = new Date(s.last_seen_at).getTime();
          const active = !s.logout_at && now - seen < ACTIVE_WINDOW_MS;
          const left = !s.logout_at && !active;

          const statusDot = active
            ? "#3fb950"
            : s.logout_at
              ? "#8b949e"
              : "#d29922";
          const statusText = active
            ? "Active now"
            : s.logout_at
              ? `Signed out ${relativeTime(s.logout_at)}`
              : `Left ${relativeTime(s.last_seen_at)}`;

          return (
            <tr
              key={s.sid}
              className={i === 0 ? "" : "border-t border-[var(--color-line-soft)]"}
            >
              <td className="py-3 pl-5 pr-3">
                <div className="flex items-center gap-2.5">
                  <Avatar handle={s.handle || s.username} src={s.avatar_url} size={28} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--color-ink)]">
                      {s.username}
                    </div>
                    <div className="text-[11px] text-[var(--color-faint)]">
                      {s.role === "admin" ? "Admin" : "Member"}
                    </div>
                  </div>
                </div>
              </td>
              <td
                className="whitespace-nowrap py-3 pr-3 text-[var(--color-muted)]"
                title={shortDate(s.login_at)}
              >
                {relativeTime(s.login_at)}
              </td>
              <td className="py-3 pr-3">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                  <span
                    className={left ? "inline-block size-[7px] rounded-full" : "relative flex size-[7px]"}
                  >
                    {active ? (
                      <span
                        className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                        style={{ backgroundColor: statusDot }}
                      />
                    ) : null}
                    <span
                      className="relative inline-flex size-[7px] rounded-full"
                      style={{ backgroundColor: statusDot }}
                    />
                  </span>
                  {statusText}
                </span>
              </td>
              <td className="hidden py-3 pr-3 text-[var(--color-muted)] sm:table-cell">
                {device(s.user_agent)}
              </td>
              <td className="hidden py-3 pr-5 text-right font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-faint)] md:table-cell">
                {s.ip ?? ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
