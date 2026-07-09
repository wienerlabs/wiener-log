"use client";

import { useActionState } from "react";
import { createToken, revokeToken, type TokenState } from "@/lib/token-actions";
import { CopyBlock } from "@/components/copy-block";
import type { ApiTokenRow } from "@/lib/tokens";
import { relativeTime } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export function ApiTokens({ tokens }: { tokens: ApiTokenRow[] }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(
    createToken,
    {},
  );

  return (
    <div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-[12px] text-[var(--color-muted)]">Name</label>
          <input
            name="name"
            placeholder="e.g. my laptop"
            className="mt-1 w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
          />
        </div>
        <div>
          <label className="text-[12px] text-[var(--color-muted)]">Type</label>
          <select
            name="kind"
            className="mt-1 w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
          >
            <option value="ingest">Ingest (events)</option>
            <option value="mcp">MCP (read)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[11px] bg-[var(--color-btn)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>

      {state.token ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium text-[var(--color-warn)]">
            Copy this now — it is shown only once.
          </p>
          <CopyBlock text={state.token} />
        </div>
      ) : null}

      {tokens.length ? (
        <div className="mt-4 divide-y divide-[var(--color-line-soft)] rounded-[12px] ring-1 ring-[var(--color-ring)]">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-[var(--color-ink)]">
                  {t.name || "(unnamed)"}{" "}
                  <span className="rounded-full bg-[var(--color-line-soft)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-muted)]">
                    {t.kind}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--color-faint)]">
                  created {relativeTime(t.created_at)}
                  {t.last_used_at ? ` · used ${relativeTime(t.last_used_at)}` : " · never used"}
                </div>
              </div>
              <form action={revokeToken}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  title="Revoke"
                  className="flex size-8 items-center justify-center rounded-[8px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line-soft)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="size-[15px]" strokeWidth={2} />
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
