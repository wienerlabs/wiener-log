"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type PasswordState } from "@/lib/settings-actions";
import { Check } from "lucide-react";

const fieldCls =
  "w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent-soft)]";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input
        type="password"
        name="current"
        required
        autoComplete="current-password"
        placeholder="Current password"
        className={fieldCls}
      />
      <input
        type="password"
        name="next"
        required
        autoComplete="new-password"
        placeholder="New password"
        className={fieldCls}
      />
      <input
        type="password"
        name="confirm"
        required
        autoComplete="new-password"
        placeholder="Confirm new password"
        className={fieldCls}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[11px] bg-[var(--color-btn)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
        {state.ok ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-ok)]">
            <Check className="size-4" strokeWidth={2.5} /> Updated
          </span>
        ) : null}
        {state.error ? (
          <span className="text-[13px] font-medium text-[var(--color-danger)]">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
