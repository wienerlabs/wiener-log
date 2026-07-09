import type { ReactNode } from "react";
import { PALETTE, SPRITES } from "@/lib/frp/sprites";
import { SIN_COLOR, SIN_LABEL_TR } from "@/lib/frp/items";
import type { Sin } from "@/lib/frp/types";

function normalize(rows: string[]): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => r.padEnd(w, "."));
}

export function PixelSprite({
  name,
  cell = 4,
  className,
  glow,
}: {
  name: string;
  cell?: number;
  className?: string;
  glow?: string;
}) {
  const raw = SPRITES[name];
  if (!raw) return null;
  const rows = normalize(raw);
  const w = rows[0].length * cell;
  const h = rows.length * cell;
  const rects: ReactNode[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const color = PALETTE[rows[y][x]];
      if (!color || color === "transparent") continue;
      rects.push(
        <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color} />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      shapeRendering="crispEdges"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 3px ${glow})` } : undefined}
    >
      {rects}
    </svg>
  );
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  const s = seed || "x";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(hex: string, amt: number): string {
  if (!hex || hex[0] !== "#") return "#8a8172";
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const HAIRS = ["#2a1c12", "#4a3218", "#6e4b2a", "#8b7355", "#c79a45", "#a8433a", "#7a5a8a"];
const EYES = ["#3a5a8a", "#3f7a4a", "#6e4b2a", "#2a2020", "#7a4a8a"];
const RACE_SKIN: Record<string, string[]> = {
  human: ["#d7a583", "#c68642", "#9c6b47", "#e8b98f"],
  half_elf: ["#e6c39a", "#d7a583", "#c99a6f"],
  elf: ["#efdcc8", "#e6cbb0", "#f4e8da"],
  dwarf: ["#d6996a", "#c78a58", "#e2a878"],
  orc: ["#5c8036", "#6a9440", "#4e7030"],
  goblin: ["#88ad3e", "#9abd52", "#77a033"],
  tiefling: ["#c8443c", "#d6564c", "#ad342e"],
};
const RACE_HAIR: Record<string, string[]> = {
  orc: ["#1c1610", "#2a2018", "#3a2a1a"],
  goblin: ["#22180f", "#331f12", "#2a2018"],
  tiefling: ["#1a1010", "#3a1414", "#5a1a1a"],
};
const RACE_EYE: Record<string, string> = {
  orc: "#d1b13a",
  goblin: "#d1b13a",
  tiefling: "#f0c040",
};

function buildPortrait(
  seed: string,
  race?: string,
  sin?: Sin,
): (string | null)[][] {
  const N = 12;
  const g: (string | null)[][] = Array.from({ length: N }, () =>
    Array(N).fill(null),
  );
  try {
    const hs = hashSeed(seed);
    const pick = (arr: string[], shift: number): string =>
      arr && arr.length ? arr[(hs >>> shift) % arr.length] : "#c98d6a";
    const skins = RACE_SKIN[race || "human"] || RACE_SKIN.human;
    const skin = pick(skins, 0);
    const hairArr = (race && RACE_HAIR[race]) || HAIRS;
    const hair = pick(hairArr, 3);
    const eye = sin
      ? SIN_COLOR[sin] || "#2a2020"
      : (race && RACE_EYE[race]) || pick(EYES, 7);
    const beard = ((hs >>> 11) & 1) === 1 || race === "dwarf";
    const style = (hs >>> 13) % 3;
    const dark = shade(skin, -26);

    for (let y = 2; y <= 10; y++) for (let x = 3; x <= 8; x++) g[y][x] = skin;
    for (let y = 3; y <= 9; y++) {
      g[y][3] = dark;
      g[y][8] = dark;
    }
    for (let y = 0; y <= 2; y++) for (let x = 3; x <= 8; x++) g[y][x] = hair;
    if (style !== 2) for (let y = 2; y <= 6; y++) (g[y][2] = hair), (g[y][9] = hair);
    if (style === 1) for (let y = 3; y <= 9; y++) (g[y][2] = hair), (g[y][9] = hair);
    g[3][4] = shade(hair, 12);
    g[3][7] = shade(hair, 12);
    g[4][4] = eye;
    g[4][7] = eye;
    g[6][5] = dark;
    g[6][6] = dark;
    g[8][5] = "#7a4a3a";
    g[8][6] = "#7a4a3a";

    if (race === "elf" || race === "half_elf") {
      g[3][2] = skin;
      g[4][2] = skin;
      g[5][2] = dark;
      g[3][9] = skin;
      g[4][9] = skin;
      g[5][9] = dark;
    }
    if (race === "goblin") {
      g[3][1] = skin;
      g[4][1] = skin;
      g[5][1] = dark;
      g[3][2] = skin;
      g[4][2] = skin;
      g[3][10] = skin;
      g[4][10] = skin;
      g[5][10] = dark;
      g[3][9] = skin;
      g[4][9] = skin;
    }
    if (race === "tiefling") {
      g[0][3] = "#241012";
      g[1][3] = "#4a1c1c";
      g[0][8] = "#241012";
      g[1][8] = "#4a1c1c";
    }
    if (race === "orc" || race === "goblin") {
      g[9][4] = "#f2f2f6";
      g[9][7] = "#f2f2f6";
      g[8][4] = "#dfe0e6";
      g[8][7] = "#dfe0e6";
    }
    if (beard) {
      for (let y = 7; y <= 10; y++) for (let x = 3; x <= 8; x++) g[y][x] = hair;
      g[8][5] = "#5a3a2f";
      g[8][6] = "#5a3a2f";
      if (race === "dwarf") {
        for (let x = 3; x <= 8; x++) g[1][x] = "#8a8a97";
        g[0][4] = "#c79a45";
        g[0][7] = "#c79a45";
      }
    }
    g[11][5] = skin;
    g[11][6] = skin;
    if (sin) {
      g[1][5] = SIN_COLOR[sin] || "#2a2020";
      g[1][6] = SIN_COLOR[sin] || "#2a2020";
    }
    return g;
  } catch {
    for (let y = 2; y <= 10; y++) for (let x = 3; x <= 8; x++) g[y][x] = "#c98d6a";
    g[4][4] = "#2a2020";
    g[4][7] = "#2a2020";
    return g;
  }
}

export function PixelPortrait({
  seed,
  cell = 7,
  race,
  sin,
  className,
}: {
  seed: string;
  cell?: number;
  race?: string | null;
  sin?: Sin | null;
  className?: string;
}) {
  const g = buildPortrait(seed, race ?? undefined, sin ?? undefined);
  const size = 12 * cell;
  const rects: ReactNode[] = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const c = g[y][x];
      if (!c) continue;
      rects.push(
        <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={c} />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={sin ? { filter: `drop-shadow(0 0 4px ${SIN_COLOR[sin]})` } : undefined}
    >
      {rects}
    </svg>
  );
}

export function PixelBar({
  value,
  max,
  color,
  seg = 14,
  height = 12,
  track = "#d3c4a4",
}: {
  value: number;
  max: number;
  color: string;
  seg?: number;
  height?: number;
  track?: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const filled = Math.round(ratio * seg);
  return (
    <div
      className="flex gap-[2px] rounded-[3px] p-[2px]"
      style={{ height, background: "#00000012" }}
    >
      {Array.from({ length: seg }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ background: i < filled ? color : track }}
        />
      ))}
    </div>
  );
}

export function SinSigil({ sin, size = 16 }: { sin: Sin; size?: number }) {
  const color = SIN_COLOR[sin];
  return (
    <span
      title={SIN_LABEL_TR[sin]}
      className="inline-flex shrink-0 rotate-45 items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `${color}26`,
        border: `1.5px solid ${color}`,
        borderRadius: 3,
      }}
    >
      <span className="-rotate-45 text-[9px] font-bold leading-none" style={{ color }}>
        {SIN_LABEL_TR[sin][0]}
      </span>
    </span>
  );
}
