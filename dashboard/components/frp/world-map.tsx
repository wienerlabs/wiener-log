"use client";

import { MAP_NODES, MAP_VIEW, WORLD_MAP, KIND_TR, type NodeKind } from "@/lib/frp/worldmap";

const HOUSE_COLOR: Record<string, string> = {
  kanli_tac: "#b0483f",
  kara_kuzgun: "#4a4356",
  gumus_kurt: "#7c8a99",
  altin_aslan: "#c8912e",
  yesil_yilan: "#3f7a4a",
  kizil_gul: "#b0506a",
};
const NEUTRAL = "#8a8172";

const KIND_GLYPH: Record<NodeKind, string> = {
  hub: "★",
  market: "$",
  forge: "⚒",
  wild: "♣",
  dungeon: "⌂",
  boss: "☠",
  sanctum: "✦",
};

function nodeColor(key: string, control: Record<string, string>): string {
  const h = control[key] || WORLD_MAP[key]?.house;
  return h ? HOUSE_COLOR[h] || NEUTRAL : NEUTRAL;
}

const EDGES: [string, string][] = (() => {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const n of MAP_NODES)
    for (const m of n.neighbors) {
      const k = [n.key, m].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([n.key, m]);
    }
  return out;
})();

export function WorldMap({
  position,
  discovered,
  nodeControl,
  canTravel,
  onTravel,
  busy,
}: {
  position: string | null;
  discovered: string[];
  nodeControl: Record<string, string>;
  canTravel: boolean;
  onTravel: (key: string) => void;
  busy: boolean;
}) {
  const seen = new Set(discovered || []);
  const here = position ? WORLD_MAP[position] : undefined;
  const reach = new Set(here?.neighbors || []);
  const hereNode = here ? WORLD_MAP[here.key] : undefined;

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
        Dünya haritası
      </div>
      <svg
        viewBox={`0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}`}
        className="w-full rounded-[10px]"
        style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}
      >
        {EDGES.map(([a, b], i) => {
          const na = WORLD_MAP[a];
          const nb = WORLD_MAP[b];
          const lit = seen.has(a) && seen.has(b);
          const onPath = position === a || position === b;
          return (
            <line
              key={i}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={onPath ? "var(--frp-accent)" : "var(--frp-line)"}
              strokeOpacity={onPath ? 0.6 : lit ? 0.5 : 0.18}
              strokeWidth={onPath ? 1.4 : 1}
              strokeDasharray={lit || onPath ? undefined : "2 3"}
            />
          );
        })}
        {MAP_NODES.map((n) => {
          const isHere = position === n.key;
          const known = seen.has(n.key);
          const travelable = canTravel && reach.has(n.key) && !busy;
          const color = known ? nodeColor(n.key, nodeControl) : "var(--frp-line)";
          const r = isHere ? 8.5 : known ? 7 : 4.5;
          return (
            <g
              key={n.key}
              onClick={travelable ? () => onTravel(n.key) : undefined}
              style={{ cursor: travelable ? "pointer" : "default" }}
            >
              {isHere ? (
                <circle cx={n.x} cy={n.y} r={13} fill="var(--frp-accent)" opacity={0.14}>
                  <animate attributeName="r" values="11;15;11" dur="2.4s" repeatCount="indefinite" />
                </circle>
              ) : null}
              {travelable && !isHere ? (
                <circle cx={n.x} cy={n.y} r={r + 3.5} fill="none" stroke="var(--frp-accent)" strokeWidth={1.2} strokeDasharray="2 2" opacity={0.9} />
              ) : null}
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={known ? color : "var(--frp-surface)"}
                fillOpacity={known ? 0.92 : 1}
                stroke={isHere ? "var(--frp-accent)" : known ? "#00000030" : "var(--frp-line)"}
                strokeWidth={isHere ? 2 : 1}
              />
              {known ? (
                <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={8} fill="#ffffff" style={{ pointerEvents: "none", fontWeight: 700 }}>
                  {KIND_GLYPH[n.kind]}
                </text>
              ) : (
                <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={8} fill="var(--frp-faint)" style={{ pointerEvents: "none" }}>
                  ?
                </text>
              )}
              {known ? (
                <text
                  x={n.x}
                  y={n.y + (n.y > MAP_VIEW.h - 24 ? -13 : 17)}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={isHere ? "var(--frp-accent-ink)" : "var(--frp-muted)"}
                  style={{ pointerEvents: "none", fontWeight: isHere ? 700 : 500 }}
                >
                  {n.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px]" style={{ color: "var(--frp-muted)" }}>
        <span>
          {hereNode ? (
            <>
              Buradasın: <span style={{ color: "var(--frp-ink-soft)", fontWeight: 600 }}>{hereNode.name}</span> · {KIND_TR[hereNode.kind]}
            </>
          ) : (
            "Konum bilinmiyor"
          )}
        </span>
        {canTravel ? <span style={{ color: "var(--frp-accent-ink)" }}>komşuya tıkla</span> : null}
      </div>
    </div>
  );
}
