"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-[12px] bg-[var(--color-canvas)] p-4 pr-12 font-[family-name:var(--font-mono)] text-[12px] leading-[1.7] text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)]">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-[8px] bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)] transition-colors hover:text-[var(--color-ink)]"
      >
        {copied ? (
          <Check className="size-[15px] text-[var(--color-ok)]" strokeWidth={2.5} />
        ) : (
          <Copy className="size-[15px]" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
