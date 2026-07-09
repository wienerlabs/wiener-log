import { PixelPortrait, PixelBar, PixelSprite, SinSigil } from "@/components/frp/pixel";
import { itemById, RARITY_COLOR, SIN_COLOR, SIN_LABEL } from "@/lib/frp/items";
import { classById } from "@/lib/frp/classes";
import type { Character, Sin } from "@/lib/frp/types";
import { Skull } from "lucide-react";

const SINS: Sin[] = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"];

function dominantSin(c: Character): { sin: Sin; value: number } | null {
  let best: { sin: Sin; value: number } | null = null;
  for (const s of SINS) {
    const v = c.corruption?.[s] || 0;
    if (v > 0 && (!best || v > best.value)) best = { sin: s, value: v };
  }
  return best;
}

export function CharacterCard({
  character: c,
  isTurn = false,
  compact = false,
}: {
  character: Character;
  isTurn?: boolean;
  compact?: boolean;
}) {
  const cls = classById(c.class);
  const dom = dominantSin(c);
  const dead = !c.alive;

  return (
    <div
      className={`rounded-[14px] border p-3.5 transition-colors ${
        isTurn
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)]"
      } ${dead ? "opacity-55 grayscale" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-[10px] bg-[var(--color-canvas)] p-1 ring-1 ring-[var(--color-ring)]">
          <PixelPortrait
            seed={c.portrait_seed}
            cell={compact ? 5 : 7}
            sin={dom && dom.value >= 25 ? dom.sin : null}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
              {c.name}
            </span>
            {dead ? (
              <Skull className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
            ) : null}
          </div>
          <div className="text-[11px] text-[var(--color-faint)]">
            @{c.handle} · Lv{c.level} {c.race} {cls?.name || c.class}
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[9px] font-bold text-[var(--color-faint)]">HP</span>
              <div className="flex-1">
                <PixelBar value={c.hp_cur} max={c.hp_max} color="#f85149" seg={compact ? 10 : 14} height={compact ? 8 : 10} />
              </div>
              <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
                {c.hp_cur}/{c.hp_max}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[9px] font-bold text-[var(--color-faint)]">MP</span>
              <div className="flex-1">
                <PixelBar value={c.mp_cur} max={c.mp_max} color="#2f81f7" seg={compact ? 10 : 14} height={compact ? 8 : 10} />
              </div>
              <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
                {c.mp_cur}/{c.mp_max}
              </span>
            </div>
            {dom ? (
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0"><SinSigil sin={dom.sin} size={13} /></span>
                <div className="flex-1">
                  <PixelBar value={dom.value} max={100} color={SIN_COLOR[dom.sin]} seg={compact ? 10 : 14} height={compact ? 8 : 10} />
                </div>
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums" style={{ color: SIN_COLOR[dom.sin] }}>
                  {dom.value}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!compact ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(c.inventory || []).slice(0, 10).map((it, i) => {
              const item = itemById(it.id);
              const color = item ? RARITY_COLOR[item.rarity] : "#8b949e";
              return (
                <div
                  key={`${it.id}-${i}`}
                  title={item ? `${item.name} (${item.rarity})` : it.id}
                  className="flex size-9 items-center justify-center rounded-[7px] bg-[var(--color-canvas)]"
                  style={{ border: `1.5px solid ${color}` }}
                >
                  {item ? (
                    <PixelSprite name={item.sprite} cell={2} glow={item.rarity === "legendary" ? color : undefined} />
                  ) : (
                    <span className="text-[8px] text-[var(--color-faint)]">?</span>
                  )}
                </div>
              );
            })}
          </div>
          {(c.status_effects || []).length || c.wielded ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {c.wielded ? (
                <span className="rounded-full bg-[var(--color-line-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-soft)]">
                  wielding {itemById(c.wielded)?.name || c.wielded}
                </span>
              ) : null}
              {(c.status_effects || []).map((s) => (
                <span key={s.id} className="rounded-full bg-[var(--color-line-soft)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                  {s.label}
                </span>
              ))}
            </div>
          ) : null}
          {dom && dom.value > 0 ? (
            <div className="mt-2 text-[10.5px]" style={{ color: SIN_COLOR[dom.sin] }}>
              {SIN_LABEL[dom.sin]} takes root.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
