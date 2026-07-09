import { LOCATIONS } from "@/lib/frp/locations";
import { HOUSES } from "@/lib/frp/houses";
import { PixelSprite } from "@/components/frp/pixel";
import type { Campaign } from "@/lib/frp/types";
import { Skull, ScrollText, Check, X } from "lucide-react";

export function WorldHud({ campaign }: { campaign: Campaign }) {
  const doom = campaign.doom || 0;
  const quests = campaign.quests || [];
  const rep = campaign.reputation || {};
  const repHouses = HOUSES.filter((h) => rep[h.id] !== undefined && rep[h.id] !== 0);
  const cur = campaign.current_location;
  const green = "#3f7a4a";

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
        <div className="mb-1 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
          Konum
        </div>
        <div className="flex flex-wrap gap-1">
          {LOCATIONS.map((l) => (
            <span
              key={l.key}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: cur === l.key ? "var(--frp-accent)" : "var(--frp-canvas)",
                color: cur === l.key ? "#fff" : "var(--frp-muted)",
                border: "1px solid var(--frp-line)",
              }}
            >
              {l.tr}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
