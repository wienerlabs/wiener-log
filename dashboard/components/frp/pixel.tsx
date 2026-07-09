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
  const N = 16;
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
    const dark = shade(skin, -24);
    const dark2 = shade(skin, -44);
    const brow = shade(hair, -12);
    const white = "#f4efe4";

    for (let y = 3; y <= 13; y++) for (let x = 4; x <= 11; x++) g[y][x] = skin;
    for (let y = 4; y <= 12; y++) {
      g[y][4] = dark;
      g[y][11] = dark;
    }
    g[13][5] = dark;
    g[13][10] = dark;
    for (let y = 0; y <= 3; y++) for (let x = 4; x <= 11; x++) g[y][x] = hair;
    g[3][5] = shade(hair, 14);
    g[3][10] = shade(hair, 14);
    if (style !== 2) for (let y = 3; y <= 8; y++) (g[y][3] = hair), (g[y][12] = hair);
    if (style === 1) for (let y = 3; y <= 12; y++) (g[y][3] = hair), (g[y][12] = hair);
    g[5][5] = brow;
    g[5][6] = brow;
    g[5][9] = brow;
    g[5][10] = brow;
    g[6][5] = white;
    g[6][6] = eye;
    g[7][6] = shade(eye, -22);
    g[6][10] = white;
    g[6][9] = eye;
    g[7][9] = shade(eye, -22);
    g[8][7] = dark;
    g[8][8] = dark;
    g[9][7] = dark2;
    g[9][8] = dark2;
    g[11][6] = "#8a4a3e";
    g[11][7] = "#8a4a3e";
    g[11][8] = "#8a4a3e";
    g[11][9] = "#8a4a3e";
    g[12][7] = shade(skin, -14);
    g[12][8] = shade(skin, -14);

    if (race === "elf" || race === "half_elf") {
      g[5][3] = skin;
      g[6][3] = skin;
      g[7][3] = dark;
      g[5][12] = skin;
      g[6][12] = skin;
      g[7][12] = dark;
    }
    if (race === "goblin") {
      g[5][2] = skin;
      g[6][2] = skin;
      g[7][2] = dark;
      g[5][3] = skin;
      g[6][3] = skin;
      g[5][13] = skin;
      g[6][13] = skin;
      g[7][13] = dark;
      g[5][12] = skin;
      g[6][12] = skin;
    }
    if (race === "tiefling") {
      g[0][4] = "#2a1210";
      g[1][4] = "#4a1c1a";
      g[2][4] = "#5a221e";
      g[0][11] = "#2a1210";
      g[1][11] = "#4a1c1a";
      g[2][11] = "#5a221e";
    }
    if (beard) {
      for (let y = 10; y <= 14; y++) for (let x = 4; x <= 11; x++) g[y][x] = hair;
      g[11][6] = "#5a2a24";
      g[11][7] = "#5a2a24";
      g[11][8] = "#5a2a24";
      g[11][9] = "#5a2a24";
      if (race === "dwarf") {
        for (let x = 4; x <= 11; x++) {
          g[1][x] = "#9a9aa6";
          g[2][x] = "#7e7e8c";
        }
        g[0][6] = "#c79a45";
        g[0][9] = "#c79a45";
      }
    }
    if (race === "orc" || race === "goblin") {
      g[12][6] = white;
      g[12][9] = white;
    }
    g[14][7] = skin;
    g[14][8] = skin;
    g[15][7] = dark;
    if (sin) {
      g[2][7] = SIN_COLOR[sin] || "#2a2020";
      g[2][8] = SIN_COLOR[sin] || "#2a2020";
    }
    return g;
  } catch {
    for (let y = 3; y <= 13; y++) for (let x = 4; x <= 11; x++) g[y][x] = "#c98d6a";
    g[6][6] = "#2a2020";
    g[6][9] = "#2a2020";
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
  const n = g.length;
  const size = n * cell;
  const rects: ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < g[y].length; x++) {
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
