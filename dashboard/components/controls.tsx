"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabOption = { key: string; label: string; count?: number };

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: TabOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[12px] bg-[var(--color-line-soft)] p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[13px] font-medium transition-all",
              active
                ? "bg-[var(--color-raised)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink-soft)]",
            )}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums",
                  active
                    ? "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]"
                    : "bg-black/[0.04] text-[var(--color-faint)]",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-[260px]">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[var(--color-faint)]"
        strokeWidth={2}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-[13.5px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
      />
    </div>
  );
}
