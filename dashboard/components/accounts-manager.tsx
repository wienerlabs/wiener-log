"use client";

import { useActionState } from "react";
import { toggleRole, type RoleState } from "@/lib/settings-actions";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/lib/db";

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        role === "admin"
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "bg-[var(--color-line-soft)] text-[var(--color-muted)]",
      )}
    >
      {role === "admin" ? "Admin" : "Member"}
    </span>
  );
}

export function AccountsManager({
  accounts,
  currentUsername,
}: {
  accounts: AccountRow[];
  currentUsername: string;
}) {
  const [state, action, pending] = useActionState<RoleState, FormData>(
    toggleRole,
    {},
  );

  return (
    <div>
      <div className="divide-y divide-[var(--color-line-soft)]">
        {accounts.map((a) => {
          const target = a.role === "admin" ? "employee" : "admin";
          const isYou = a.username === currentUsername;
          return (
            <div key={a.username} className="flex items-center gap-3 px-5 py-3">
              <Avatar handle={a.handle || a.username} src={a.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                  {a.username}
                  {isYou ? (
                    <span className="ml-1.5 text-[11px] font-normal text-[var(--color-faint)]">
                      you
                    </span>
                  ) : null}
                </div>
                {a.handle ? (
                  <div className="text-[11.5px] text-[var(--color-faint)]">
                    @{a.handle}
                  </div>
                ) : null}
              </div>
              <RoleBadge role={a.role} />
              <form action={action}>
                <input type="hidden" name="username" value={a.username} />
                <input type="hidden" name="role" value={target} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-[9px] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)] disabled:opacity-50"
                >
                  {target === "admin" ? "Make admin" : "Make member"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
      {state.error ? (
        <p className="px-5 py-2.5 text-[12.5px] font-medium text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
