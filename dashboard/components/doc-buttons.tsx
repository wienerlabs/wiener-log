"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Trash2 } from "lucide-react";

export function NewDocButton({
  scope,
  label = "New document",
}: {
  scope: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (r.ok) {
        const d = (await r.json()) as { id: number };
        router.push(`/docs/${d.id}`);
        return;
      }
    } catch {
      /* ignore */
    }
    setBusy(false);
  };
  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-btn)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
    >
      <FilePlus2 className="size-4" strokeWidth={2} /> {label}
    </button>
  );
}

export function DeleteDocButton({ id, backTo }: { id: number; backTo: string }) {
  const router = useRouter();
  const del = async () => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await fetch(`/api/docs/${id}`, { method: "DELETE" });
      router.push(backTo);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={del}
      className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-muted)] ring-1 ring-[var(--color-ring)] transition-colors hover:text-[var(--color-danger)]"
    >
      <Trash2 className="size-4" strokeWidth={2} /> Delete
    </button>
  );
}
