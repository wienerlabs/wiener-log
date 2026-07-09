"use client";

import { useState } from "react";
import { setProgressAction } from "@/lib/okr-actions";

export function ProgressSlider({
  id,
  initial,
  title,
  canEdit,
}: {
  id: number;
  initial: number;
  title: string;
  canEdit: boolean;
}) {
  const [val, setVal] = useState(initial);
  const commit = () => setProgressAction(id, val);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--color-ink-soft)]">{title}</span>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">
          {val}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-line-soft)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${val}%` }}
        />
      </div>
      {canEdit ? (
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="mt-1.5 w-full accent-[var(--color-accent)]"
        />
      ) : null}
    </div>
  );
}
