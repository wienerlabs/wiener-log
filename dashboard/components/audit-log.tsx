import type { AuditRow } from "@/lib/audit";
import { EmptyState } from "@/components/ui";
import { relativeTime, shortDate } from "@/lib/utils";

function describe(a: AuditRow): { text: string; detail: string | null } {
  const d = a.detail || {};
  if (a.action === "assign_task") {
    return {
      text: `assigned a task to ${a.target}`,
      detail: (d.title as string) || null,
    };
  }
  if (a.action === "set_role") {
    return { text: `set ${a.target} as ${d.role || "member"}`, detail: null };
  }
  if (a.action === "accept_task") {
    return { text: "accepted a task suggestion", detail: null };
  }
  if (a.action === "reject_task") {
    return { text: "dismissed a task suggestion", detail: null };
  }
  if (a.action === "accept_suggestion") {
    return {
      text: `opened a GitHub issue in ${a.target}`,
      detail: (d.title as string) || null,
    };
  }
  if (a.action === "dismiss_suggestion") {
    return {
      text: `dismissed a suggestion for ${a.target}`,
      detail: (d.title as string) || null,
    };
  }
  return { text: `${a.action} ${a.target ?? ""}`.trim(), detail: null };
}

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No admin actions recorded yet.</EmptyState>;
  }
  return (
    <div className="divide-y divide-[var(--color-line-soft)]">
      {rows.map((a) => {
        const { text, detail } = describe(a);
        return (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-[var(--color-ink-soft)]">
                <span className="font-medium text-[var(--color-ink)]">
                  {a.actor}
                </span>{" "}
                {text}
              </div>
              {detail ? (
                <div className="mt-0.5 line-clamp-1 text-[12px] text-[var(--color-faint)]">
                  {detail}
                </div>
              ) : null}
            </div>
            <span
              className="w-0 whitespace-nowrap pl-2 text-right text-[11.5px] text-[var(--color-faint)]"
              title={shortDate(a.at)}
            >
              {relativeTime(a.at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
