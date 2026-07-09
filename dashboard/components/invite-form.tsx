"use client";

import { useActionState } from "react";
import { makeInvite, type InviteState } from "@/lib/invite-actions";
import { CopyBlock } from "@/components/copy-block";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    makeInvite,
    {},
  );
  return (
    <div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="handle"
          placeholder="github-handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[11px] bg-[var(--color-btn)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "…" : "Generate invite link"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-2 text-[12.5px] font-medium text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.link ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] text-[var(--color-muted)]">
            Send this link to the teammate. They set a password and they are in.
          </p>
          <CopyBlock text={state.link} />
        </div>
      ) : null}
    </div>
  );
}
