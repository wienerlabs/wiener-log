"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, RACES } from "@/lib/frp/classes";
import { PixelPortrait } from "@/components/frp/pixel";
import { Card } from "@/components/ui";

export function JoinPanel({ id }: { id: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cls, setCls] = useState(CLASSES[0].id);
  const [race, setRace] = useState(RACES[0].id);
  const [busy, setBusy] = useState(false);

  const seed = `${name || "hero"}:${cls}:${race}`;
  const active = CLASSES.find((c) => c.id === cls);

  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/frp/${id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, cls, race }),
      });
      if (res.ok) router.refresh();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-[12px] bg-[var(--color-canvas)] p-1.5 ring-1 ring-[var(--color-ring)]">
          <PixelPortrait seed={seed} cell={8} />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[var(--color-ink)]">
            Roll a character
          </div>
          <div className="text-[12px] text-[var(--color-faint)]">
            {active?.blurb}
          </div>
        </div>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        className="mb-4 w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
      />

      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-[var(--color-faint)]">
        Class
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCls(c.id)}
            className={`rounded-[11px] border p-2.5 text-left transition-colors ${
              cls === c.id
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-line)] bg-[var(--color-canvas)] hover:bg-[var(--color-line-soft)]"
            }`}
          >
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">
              {c.name}
            </div>
            <div className="text-[10.5px] text-[var(--color-faint)]">
              {c.hp} HP · {c.mp} MP · {c.ability}
            </div>
          </button>
        ))}
      </div>

      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-[var(--color-faint)]">
        Race
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {RACES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRace(r.id)}
            title={r.blurb}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              race === r.id
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-canvas)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)]"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="w-full rounded-[11px] bg-[var(--color-btn)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Joining..." : "Join the party"}
      </button>
    </Card>
  );
}
