"use client";

import { useState } from "react";
import { PixelPortrait } from "@/components/frp/pixel";
import { stackInventory, itemNameTr } from "@/lib/frp/items";
import { Users, Coins, Gift } from "lucide-react";
import type { Character } from "@/lib/frp/types";

export function PartyMeet({
  id,
  myChar,
  allies,
  onDone,
}: {
  id: number;
  myChar: Character;
  allies: Character[];
  onDone: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!allies.length) return null;

  const give = async (to: string, payload: { gold?: number; item?: string }, key: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await fetch(`/api/frp/${id}/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ give: { to, ...payload } }),
      });
      await onDone();
    } catch {
      /* ignore */
    }
    setBusy(null);
  };

  const myItems = stackInventory(myChar.inventory || []);
  const gold = myChar.gold || 0;

  return (
    <div className="rounded-[12px] p-3" style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}>
      <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--frp-accent-ink)" }}>
        <Users className="size-[13px]" strokeWidth={2} /> Buradaki yoldaşlar
      </div>
      <div className="flex flex-col gap-2.5">
        {allies.map((a) => (
          <div key={a.handle} className="flex items-start gap-2.5 rounded-[10px] p-2" style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}>
            <div className="shrink-0 overflow-hidden rounded-[8px]" style={{ border: "1px solid var(--frp-line)" }}>
              <PixelPortrait seed={a.portrait_seed || a.handle} race={a.race} cell={3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-semibold" style={{ color: "var(--frp-ink)" }}>{a.name}</span>
                <span className="text-[10px]" style={{ color: "var(--frp-faint)" }}>@{a.handle}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <button type="button" disabled={!!busy || gold < 10} onClick={() => give(a.handle, { gold: 10 }, `${a.handle}-g10`)} className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[10.5px] font-medium disabled:opacity-40" style={{ background: "var(--frp-surface)", color: "var(--frp-ink-soft)", border: "1px solid var(--frp-line)" }}>
                  <Coins className="size-[11px]" strokeWidth={2} /> 10
                </button>
                <button type="button" disabled={!!busy || gold < 50} onClick={() => give(a.handle, { gold: 50 }, `${a.handle}-g50`)} className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[10.5px] font-medium disabled:opacity-40" style={{ background: "var(--frp-surface)", color: "var(--frp-ink-soft)", border: "1px solid var(--frp-line)" }}>
                  <Coins className="size-[11px]" strokeWidth={2} /> 50
                </button>
                {myItems.map((it) => (
                  <button key={it.id} type="button" disabled={!!busy} onClick={() => give(a.handle, { item: it.id }, `${a.handle}-${it.id}`)} className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[10.5px] font-medium disabled:opacity-40" style={{ background: "var(--frp-accent-soft)", color: "var(--frp-accent-ink)", border: "1px solid var(--frp-line)" }}>
                    <Gift className="size-[11px]" strokeWidth={2} /> {itemNameTr(it.id)}{(it.qty ?? 1) > 1 ? ` ×${it.qty}` : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
