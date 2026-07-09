import { HOUSES } from "@/lib/frp/houses";
import { PixelSprite, SinSigil } from "@/components/frp/pixel";
import { WorldMap } from "@/components/frp/world-map";
import type { Campaign, WorldState, Sin } from "@/lib/frp/types";
import { Skull, ScrollText, Check, X } from "lucide-react";

const ALL_SINS: Sin[] = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"];

export function WorldHud({
  campaign,
  world,
  myLocation,
  canTravel,
  onTravel,
  busy,
}: {
  campaign: Campaign;
  world: WorldState;
  myLocation: string | null;
  canTravel: boolean;
  onTravel: (key: string) => void;
  busy: boolean;
}) {
  const doom = campaign.doom || 0;
  const quests = campaign.quests || [];
  const rep = campaign.reputation || {};
  const repHouses = HOUSES.filter((h) => rep[h.id] !== undefined && rep[h.id] !== 0);
  const green = "#3f7a4a";
  const relics = new Set(world.relics || []);

  return (
    <div className="rounded-[14px] p-3.5" style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}>
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--frp-danger)" }}>
        <span className="inline-flex items-center gap-1">
          <Skull className="size-[13px]" strokeWidth={2} /> Yedinci Mühür
        </span>
        <span className="tabular-nums">{doom}/100</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--frp-track)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${doom}%`, background: "var(--frp-danger)" }} />
      </div>

      {quests.length ? (
        <div className="mt-3">
          <div className="mb-1 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
            Görevler
          </div>
          <div className="flex flex-col gap-1">
            {quests.slice(0, 6).map((q, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[12px]" style={{ color: q.status === "done" ? "var(--frp-faint)" : "var(--frp-ink-soft)" }}>
                {q.status === "done" ? (
                  <Check className="mt-0.5 size-[12px] shrink-0" style={{ color: green }} strokeWidth={2.5} />
                ) : q.status === "failed" ? (
                  <X className="mt-0.5 size-[12px] shrink-0" style={{ color: "var(--frp-danger)" }} strokeWidth={2.5} />
                ) : (
                  <ScrollText className="mt-0.5 size-[12px] shrink-0" style={{ color: "var(--frp-accent)" }} strokeWidth={2} />
                )}
                <span className={q.status === "done" ? "line-through" : ""}>
                  {q.title}
                  {q.kind === "main" ? " ★" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {repHouses.length ? (
        <div className="mt-3">
          <div className="mb-1 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
            Hanedan itibarı
          </div>
          <div className="flex flex-col gap-1.5">
            {repHouses.map((h) => {
              const v = rep[h.id];
              return (
                <div key={h.id} className="flex items-center gap-1.5">
                  <PixelSprite name={h.sprite} cell={2} />
                  <span className="w-16 shrink-0 truncate text-[10.5px]" style={{ color: "var(--frp-muted)" }}>{h.name}</span>
                  <div className="relative h-1.5 flex-1 rounded-full" style={{ background: "var(--frp-track)" }}>
                    <div className="absolute top-0 h-full" style={{ left: "50%", width: 1, background: "var(--frp-line)" }} />
                    <div
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        left: v < 0 ? `${50 + v / 2}%` : "50%",
                        width: `${Math.min(50, Math.abs(v) / 2)}%`,
                        background: v >= 0 ? green : "var(--frp-danger)",
                      }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[10px] tabular-nums" style={{ color: v >= 0 ? green : "var(--frp-danger)" }}>
                    {v > 0 ? "+" : ""}{v}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <WorldMap
          position={myLocation ?? campaign.position}
          discovered={campaign.discovered || []}
          nodeControl={world.node_control || {}}
          canTravel={canTravel}
          onTravel={onTravel}
          busy={busy}
        />
      </div>

      <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--frp-line)" }}>
        <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: "var(--frp-faint)" }}>
          <span className="tracking-[0.05em]">Yaşayan dünya · Yedinci Mühür</span>
          <span className="tabular-nums" style={{ color: "var(--frp-danger)" }}>{world.doom}/100</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--frp-track)" }}>
          <div className="h-full rounded-full" style={{ width: `${world.doom}%`, background: "var(--frp-corrupt)" }} />
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "var(--frp-muted)" }}>Serbest günah silahı {relics.size}/7</span>
          <span className="ml-auto flex items-center gap-0.5">
            {ALL_SINS.map((s) => (
              <span key={s} style={{ opacity: relics.has(s) ? 1 : 0.2 }}>
                <SinSigil sin={s} size={11} />
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
