"use client";

import { setStatusAction } from "@/lib/presence-actions";

export function StatusSetter({
  current,
  message,
}: {
  current: string;
  message: string | null;
}) {
  return (
    <form action={setStatusAction} className="flex flex-col gap-2 sm:flex-row">
      <select
        name="status"
        defaultValue={current}
        className="rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
      >
        <option value="available">Available</option>
        <option value="focus">Focused</option>
        <option value="away">Away</option>
        <option value="ooo">Out of office</option>
      </select>
      <input
        name="message"
        defaultValue={message || ""}
        maxLength={100}
        placeholder="Optional note (e.g. back at 3pm)"
        className="flex-1 rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
      />
      <button
        type="submit"
        className="rounded-[11px] bg-[var(--color-btn)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99]"
      >
        Update status
      </button>
    </form>
  );
}
