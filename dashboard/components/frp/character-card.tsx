import { PixelPortrait, PixelBar, PixelSprite, SinSigil } from "@/components/frp/pixel";
import {
  itemById,
  itemNameTr,
  RARITY_COLOR,
  RARITY_TR,
  SIN_COLOR,
  SIN_LABEL_TR,
} from "@/lib/frp/items";
import { CLASS_TR, RACE_TR } from "@/lib/frp/classes";
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
  const dom = dominantSin(c);
  const dead = !c.alive;
  const clsTr = CLASS_TR[c.class]?.name || c.class;
  const raceTr = RACE_TR[c.race]?.name || c.race;

  return (
    <div
      className={`rounded-[14px] border p-3.5 transition-colors ${dead ? "opacity-60 grayscale" : ""}`}
      style={{
        borderColor: isTurn ? "var(--frp-accent)" : "var(--frp-line)",
        background: isTurn ? "var(--frp-accent-soft)" : "var(--frp-surface)",
        boxShadow: isTurn ? "0 0 0 1px var(--frp-accent)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 rounded-[10px] p-1"
          style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}
        >
          <PixelPortrait
            seed={c.portrait_seed}
            cell={compact ? 5 : 7}
            sin={dom && dom.value >= 25 ? dom.sin : null}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold" style={{ color: "var(--frp-ink)" }}>
              {c.name}
            </span>
            {dead ? <Skull className="size-[13px]" style={{ color: "var(--frp-faint)" }} strokeWidth={2} /> : null}
          </div>
          <div className="text-[11px]" style={{ color: "var(--frp-faint)" }}>
            @{c.handle} · {c.level}. seviye {raceTr} {clsTr}
          </div>
          <div className="mt-2 space-y-1.5">
            <BarRow label="CAN" value={c.hp_cur} max={c.hp_max} color="var(--frp-hp)" compact={compact} />
            <BarRow label="MANA" value={c.mp_cur} max={c.mp_max} color="var(--frp-mp)" compact={compact} />
            {dom ? (
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0"><SinSigil sin={dom.sin} size={13} /></span>
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
                  title={item ? `${itemNameTr(it.id)} (${RARITY_TR[item.rarity]})` : it.id}
                  className="flex size-9 items-center justify-center rounded-[7px]"
                  style={{ background: "#00000012", border: `1.5px solid ${color}` }}
                >
                  {item ? (
                    <PixelSprite name={item.sprite} cell={2} glow={item.rarity === "legendary" ? color : undefined} />
                  ) : (
                    <span className="text-[8px]" style={{ color: "var(--frp-faint)" }}>?</span>
                  )}
                </div>
              );
            })}
          </div>
          {(c.status_effects || []).length || c.wielded ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {c.wielded ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--frp-line-soft)", color: "var(--frp-ink-soft)" }}>
                  kuşandığı: {itemNameTr(c.wielded)}
                </span>
              ) : null}
              {(c.status_effects || []).map((s) => (
                <span key={s.id} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--frp-line-soft)", color: "var(--frp-muted)" }}>
                  {s.label}
                </span>
              ))}
            </div>
          ) : null}
          {dom && dom.value > 0 ? (
            <div className="mt-2 text-[10.5px]" style={{ color: SIN_COLOR[dom.sin] }}>
              {SIN_LABEL_TR[dom.sin]} kök salıyor.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  compact,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  compact: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[9px] font-bold" style={{ color: "var(--frp-faint)" }}>{label}</span>
      <div className="flex-1">
        <PixelBar value={value} max={max} color={color} seg={compact ? 10 : 14} height={compact ? 8 : 10} />
      </div>
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums" style={{ color: "var(--frp-muted)" }}>
        {value}/{max}
      </span>
    </div>
  );
}
