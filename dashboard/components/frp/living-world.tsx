import { HOUSES, houseById } from "@/lib/frp/houses";
import { factionControl } from "@/lib/frp/world";
import { PixelSprite, SinSigil } from "@/components/frp/pixel";
import type { WorldState, WorldEvent, Sin } from "@/lib/frp/types";
import { Skull, Radio } from "lucide-react";

const ALL_SINS: Sin[] = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"];

const KIND_DOT: Record<string, string> = {
  relic: "var(--frp-corrupt)",
  boss: "var(--frp-danger)",
  capture: "var(--frp-accent)",
  gm: "var(--frp-muted)",
};

export function LivingWorld({
  world,
  events,
}: {
  world: WorldState;
  events: WorldEvent[];
}) {
  const relics = new Set(world.relics || []);
  const houses = HOUSES.map((h) => ({ h, v: factionControl(world, h.id) })).sort((a, b) => b.v - a.v);

  return (
    <div className="rounded-[16px] p-5" style={{ background: "var(--frp-surface, var(--color-surface))", border: "1px solid var(--color-line)" }}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--color-danger, #b0483f)" }}>
              <Skull className="size-[14px]" strokeWidth={2} /> Yedinci Mühür
            </span>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--color-danger, #b0483f)" }}>{world.doom}/100</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--color-line-soft)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${world.doom}%`, background: "var(--color-danger, #b0483f)" }} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Serbest günah silahı {relics.size}/7</span>
            <span className="ml-auto flex items-center gap-0.5">
              {ALL_SINS.map((s) => (
                <span key={s} title={s} style={{ opacity: relics.has(s) ? 1 : 0.2 }}>
                  <SinSigil sin={s} size={13} />
                </span>
              ))}
            </span>
          </div>

          <div className="mt-4 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--color-faint)" }}>
            Hanedanların toprak hâkimiyeti
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {houses.map(({ h, v }) => (
              <div key={h.id} className="flex items-center gap-2">
                <PixelSprite name={h.sprite} cell={2} />
                <span className="w-20 shrink-0 truncate text-[11px]" style={{ color: "var(--color-muted)" }}>{h.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-line-soft)" }}>
                  <div className="h-full rounded-full" style={{ width: `${v}%`, background: "var(--color-accent)" }} />
                </div>
                <span className="w-6 shrink-0 text-right text-[10px] tabular-nums" style={{ color: "var(--color-faint)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--color-faint)" }}>
            <Radio className="size-[12px]" strokeWidth={2} /> Dünyadan haberler
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {events.length === 0 ? (
              <div className="py-6 text-center text-[11.5px]" style={{ color: "var(--color-faint)" }}>
                Dünya şimdilik sessiz. İlk efsane bunu değiştirecek.
              </div>
            ) : (
              events.map((e) => {
                const h = e.house ? houseById(e.house) : null;
                return (
                  <div key={e.id} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--color-ink-soft, var(--color-ink))" }}>
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: KIND_DOT[e.kind] || "var(--color-muted)" }} />
                    <span className="flex-1 leading-snug">{e.text}</span>
                    {h ? <PixelSprite name={h.sprite} cell={2} /> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
