"use client";

import { useActionState, useEffect, useRef } from "react";
import { assignAction, type AssignState } from "@/lib/actions";
import { Check, Plus } from "lucide-react";

export function AssignForm({ handle }: { handle: string }) {
  const [state, action, pending] = useActionState<AssignState, FormData>(
    assignAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="handle" value={handle} />
      <input
        name="title"
        required
        maxLength={280}
        placeholder="Task title"
        className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--color-accent-soft)]"
      />
      <textarea
        name="body"
        rows={3}
        placeholder="Details (optional)"
        className="w-full resize-none rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--color-accent-soft)]"
      />
      <input
        name="repo"
        placeholder="Repo, e.g. wienerlabs/wienerlog (optional)"
        className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--color-accent-soft)]"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-ink)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {pending ? "Assigning…" : "Assign task"}
        </button>
        {state.ok ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-ok)]">
            <Check className="size-4" strokeWidth={2.5} /> Assigned
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
