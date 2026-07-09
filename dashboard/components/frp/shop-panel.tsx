"use client";

import { useState } from "react";
import { PixelSprite } from "@/components/frp/pixel";
import {
  itemNameTr,
  itemDescTr,
  itemById,
  coinBreakdown,
  itemPrice,
  sellPrice,
  priceWithDoom,
  stackInventory,
  MARKET_STOCK,
  FORGE_STOCK,
  FORGE_UPGRADES,
} from "@/lib/frp/items";
import { WORLD_MAP, isMarket, isForge } from "@/lib/frp/worldmap";
import type { Character } from "@/lib/frp/types";
import { Coins } from "lucide-react";

function Coin({ copper }: { copper: number }) {
  const c = coinBreakdown(copper);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <PixelSprite name="it_coin" cell={1} />
      {c.gold ? `${c.gold}a ` : ""}
      {c.silver ? `${c.silver}g ` : ""}
      {c.copper}b
    </span>
  );
}

export function ShopPanel({
  id,
  position,
  doom,
  myChar,
  onDone,
}: {
  id: number;
  position: string | null;
  doom: number;
  myChar: Character;
  onDone: () => Promise<void> | void;
}) {
  const node = position ? WORLD_MAP[position] : undefined;
  const market = isMarket(node?.kind);
  const forge = isForge(node?.kind);
  const [tab, setTab] = useState<"pazar" | "demirci" | "sat" | "takas">(market ? "pazar" : "demirci");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  if (!node || (!market && !forge)) return null;

  const gold = myChar.gold || 0;
  const price = (base: number) => priceWithDoom(base, doom);

  const act = async (op: string, key: string, itemKey: string) => {
    if (busy) return;
    setBusy(key);
    setErr("");
    try {
      const res = await fetch(`/api/frp/${id}/shop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op === "upgrade" ? { op, from: itemKey } : { op, item: itemKey }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!d.ok) setErr(d.error || "olmadı");
      else await onDone();
    } catch {
      setErr("bağlantı hatası");
    }
    setBusy("");
  };

  const tabs: [string, "pazar" | "demirci" | "sat" | "takas"][] = [];
  if (market) tabs.push(["Pazar", "pazar"]);
  if (forge) tabs.push(["Demirci", "demirci"]);
  tabs.push(["Sat", "sat"]);
  if (market) tabs.push(["Takas", "takas"]);

  const pouches = stackInventory(myChar.inventory || []).find((it) => it.id === "gold_pouch")?.qty ?? 0;

  const invSellable = stackInventory(myChar.inventory || []).filter((it) => itemPrice(it.id) > 0);

  return (
    <div className="mb-2 rounded-[12px] p-2.5" style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--frp-ink-soft)" }}>
          <Coins className="size-[14px]" strokeWidth={2} />
          {node.name} · {market && forge ? "pazar ve demirci" : market ? "pazar" : "demirci"}
        </span>
        <span className="text-[11px]" style={{ color: "var(--frp-muted)" }}>
          <Coin copper={gold} /> {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="mt-2.5">
          <div className="mb-2 flex gap-1.5">
            {tabs.map(([label, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: tab === key ? "var(--frp-accent)" : "var(--frp-canvas)",
                  color: tab === key ? "#fff" : "var(--frp-muted)",
                  border: "1px solid var(--frp-line)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "pazar" && market ? (
            <div className="grid grid-cols-1 gap-1">
              {MARKET_STOCK.map((iid) => {
                const p = price(itemPrice(iid));
                const can = gold >= p && !busy;
                return (
                  <Row key={iid} iid={iid} right={<Coin copper={p} />} onClick={() => act("buy", `buy-${iid}`, iid)} disabled={!can} busy={busy === `buy-${iid}`} label="al" />
                );
              })}
            </div>
          ) : null}

          {tab === "demirci" && forge ? (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 gap-1">
                {FORGE_STOCK.map((iid) => {
                  const p = price(itemPrice(iid));
                  const can = gold >= p && !busy;
                  return (
                    <Row key={iid} iid={iid} right={<Coin copper={p} />} onClick={() => act("buy", `buy-${iid}`, iid)} disabled={!can} busy={busy === `buy-${iid}`} label="al" />
                  );
                })}
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
                  Yükseltme
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {FORGE_UPGRADES.map((u) => {
                    const has = (myChar.inventory || []).some((it) => it.id === u.from);
                    const p = price(u.cost);
                    const can = has && gold >= p && !busy;
                    return (
                      <button
                        key={u.from}
                        type="button"
                        onClick={() => act("upgrade", `up-${u.from}`, u.from)}
                        disabled={!can}
                        className="flex items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition-colors disabled:opacity-40"
                        style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}
                      >
                        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--frp-ink-soft)" }}>
                          <PixelSprite name={itemById(u.from)?.sprite || "it_sword"} cell={2} />
                          {itemNameTr(u.from)} → {itemNameTr(u.to)}
                        </span>
                        <span className="text-[10.5px]" style={{ color: can ? "var(--frp-accent-ink)" : "var(--frp-faint)" }}>
                          {busy === `up-${u.from}` ? "..." : <Coin copper={p} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "sat" ? (
            <div className="grid grid-cols-1 gap-1">
              {invSellable.length === 0 ? (
                <div className="py-3 text-center text-[11px]" style={{ color: "var(--frp-faint)" }}>
                  Satılacak bir şey yok.
                </div>
              ) : (
                invSellable.map((it, i) => (
                  <Row key={`${it.id}-${i}`} iid={it.id} qty={it.qty} right={<Coin copper={sellPrice(it.id)} />} onClick={() => act("sell", `sell-${it.id}-${i}`, it.id)} disabled={!!busy} busy={busy === `sell-${it.id}-${i}`} label="sat" />
                ))
              )}
            </div>
          ) : null}

          {tab === "takas" && market ? (
            <div className="flex flex-col gap-2">
              <div
                className="rounded-[8px] px-2.5 py-2 text-[10.5px] leading-relaxed"
                style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)", color: "var(--frp-muted)" }}
              >
                Sarraf kuru: <b>1 altın = 100 bakır</b>, <b>1 gümüş = 10 bakır</b>. Kesen tek havuzda tutulur; altın, gümüş ve bakır kendiliğinden en uygun şekilde bölünür. Ağır bakırı taşınabilir bir Altın Keseye çevirebilir ya da bozabilirsin.
              </div>
              <button
                type="button"
                disabled={gold < 100 || !!busy}
                onClick={() => act("mint", "mint", "")}
                className="flex items-center justify-between rounded-[8px] px-2.5 py-2 text-left transition-colors disabled:opacity-40"
                style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}
              >
                <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--frp-ink-soft)" }}>
                  <PixelSprite name="it_coin" cell={2} /> 100 bakır → 1 Altın Kese
                </span>
                <span className="text-[10.5px] font-semibold" style={{ color: "var(--frp-accent-ink)" }}>{busy === "mint" ? "..." : "bas"}</span>
              </button>
              <button
                type="button"
                disabled={pouches < 1 || !!busy}
                onClick={() => act("melt", "melt", "")}
                className="flex items-center justify-between rounded-[8px] px-2.5 py-2 text-left transition-colors disabled:opacity-40"
                style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}
              >
                <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--frp-ink-soft)" }}>
                  <PixelSprite name="it_coin" cell={2} /> 1 Altın Kese → 100 bakır
                  <span style={{ color: "var(--frp-faint)" }}>({pouches} kese)</span>
                </span>
                <span className="text-[10.5px] font-semibold" style={{ color: "var(--frp-accent-ink)" }}>{busy === "melt" ? "..." : "boz"}</span>
              </button>
            </div>
          ) : null}

          {err ? <div className="mt-1.5 text-[10.5px]" style={{ color: "var(--frp-danger)" }}>{err}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  iid,
  right,
  onClick,
  disabled,
  busy,
  label,
  qty,
}: {
  iid: string;
  right: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  label: string;
  qty?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors disabled:opacity-40"
      style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <span className="mt-0.5 shrink-0">
          <PixelSprite name={itemById(iid)?.sprite || "it_coin"} cell={2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium" style={{ color: "var(--frp-ink-soft)" }}>
            {itemNameTr(iid)}
            {qty && qty > 1 ? <span style={{ color: "var(--frp-faint)" }}> ×{qty}</span> : null}
          </span>
          <span className="block text-[9.5px] leading-tight" style={{ color: "var(--frp-faint)" }}>
            {itemDescTr(iid)}
          </span>
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px]" style={{ color: "var(--frp-muted)" }}>
        {busy ? "..." : right}
        <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: "var(--frp-accent-soft)", color: "var(--frp-accent-ink)" }}>{label}</span>
      </span>
    </button>
  );
}
