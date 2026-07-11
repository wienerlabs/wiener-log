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
const CLOTHS = ["#5a4632", "#454552", "#3a4a68", "#573a52", "#3a5a4a", "#6a4a34"];
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

const HEAD_BOUNDS: [number, [number, number]][] = [
  [2, [8, 11]],
  [3, [7, 12]],
  [4, [6, 13]],
  [5, [6, 13]],
  [6, [5, 14]],
  [7, [5, 14]],
  [8, [5, 14]],
  [9, [5, 14]],
  [10, [6, 13]],
  [11, [6, 13]],
  [12, [7, 12]],
  [13, [8, 11]],
];

export function buildPortrait(
  seed: string,
  race?: string,
  sin?: Sin,
  gender?: string,
): (string | null)[][] {
  const N = 20;
  const g: (string | null)[][] = Array.from({ length: N }, () =>
    Array(N).fill(null),
  );
  try {
    const hs = hashSeed(seed);
    const pick = (arr: string[], shift: number): string =>
      arr && arr.length ? arr[(hs >>> shift) % arr.length] : "#c98d6a";
    const skin = pick(RACE_SKIN[race || "human"] || RACE_SKIN.human, 0);
    const hair = pick((race && RACE_HAIR[race]) || HAIRS, 3);
    const eye = sin
      ? SIN_COLOR[sin] || "#2a2020"
      : (race && RACE_EYE[race]) || pick(EYES, 7);
    const female = gender === "female";
    const beard = !female && (((hs >>> 11) & 1) === 1 || race === "dwarf");
    const style = female ? 1 : (hs >>> 13) % 3;
    const cloth = pick(CLOTHS, 17);
    const dark = shade(skin, -22);
    const dark2 = shade(skin, -40);
    const hi = shade(skin, 16);
    const brow = shade(hair, -14);
    const clothD = shade(cloth, -22);
    const clothH = shade(cloth, 18);
    const white = "#f4efe4";
    const eyeD = shade(eye, -26);

    for (const [y, [l, r]] of HEAD_BOUNDS) {
      for (let x = l; x <= r; x++) g[y][x] = skin;
      g[y][l] = dark;
      g[y][r] = dark;
    }
    g[8][6] = hi;
    g[8][13] = hi;

    for (let y = 0; y <= 1; y++) for (let x = 6; x <= 13; x++) g[y][x] = hair;
    for (let x = 5; x <= 14; x++) g[2][x] = hair;
    for (let x = 6; x <= 13; x++) {
      g[3][x] = hair;
      g[4][x] = hair;
    }
    g[4][6] = shade(hair, 14);
    g[4][13] = shade(hair, 14);
    if (style !== 2) for (let y = 4; y <= 8; y++) (g[y][5] = hair), (g[y][14] = hair);
    if (style === 1) for (let y = 4; y <= 11; y++) (g[y][5] = hair), (g[y][14] = hair);

    g[6][7] = brow;
    g[6][8] = brow;
    g[6][11] = brow;
    g[6][12] = brow;
    g[7][7] = white;
    g[7][8] = eye;
    g[8][8] = eyeD;
    g[7][12] = white;
    g[7][11] = eye;
    g[8][11] = eyeD;
    g[9][10] = hi;
    g[10][9] = dark;
    g[10][10] = dark;
    g[11][10] = dark2;
    g[12][8] = "#8a4a3e";
    g[12][9] = "#8a4a3e";
    g[12][10] = "#8a4a3e";
    g[12][11] = "#8a4a3e";
    g[13][9] = shade(skin, -14);
    g[13][10] = shade(skin, -14);

    for (let y = 14; y <= 15; y++) for (let x = 8; x <= 11; x++) g[y][x] = skin;
    g[14][8] = dark;
    g[14][11] = dark;
    for (let x = 8; x <= 11; x++) g[15][x] = dark2;

    for (let y = 16; y <= 19; y++) for (let x = 3; x <= 16; x++) g[y][x] = cloth;
    for (let y = 16; y <= 19; y++) {
      g[y][3] = clothD;
      g[y][4] = clothD;
      g[y][15] = clothD;
      g[y][16] = clothD;
    }
    for (let x = 5; x <= 14; x++) g[16][x] = clothH;
    g[16][8] = clothD;
    g[16][11] = clothD;
    g[17][9] = clothD;
    g[17][10] = clothD;
    g[16][9] = shade(skin, -10);
    g[16][10] = shade(skin, -10);

    if (race === "elf" || race === "half_elf") {
      g[6][4] = skin;
      g[7][4] = skin;
      g[8][4] = dark;
      g[6][15] = skin;
      g[7][15] = skin;
      g[8][15] = dark;
    }
    if (race === "goblin") {
      g[6][3] = skin;
      g[7][3] = skin;
      g[8][3] = dark;
      g[6][4] = skin;
      g[7][4] = skin;
      g[6][16] = skin;
      g[7][16] = skin;
      g[8][16] = dark;
      g[6][15] = skin;
      g[7][15] = skin;
    }
    if (race === "tiefling") {
      g[0][6] = "#3a1614";
      g[0][7] = "#2a1210";
      g[1][7] = "#4a1c1a";
      g[0][13] = "#3a1614";
      g[0][12] = "#2a1210";
      g[1][12] = "#4a1c1a";
    }
    if (beard) {
      for (const [y, [l, r]] of HEAD_BOUNDS)
        if (y >= 10) for (let x = l; x <= r; x++) g[y][x] = hair;
      for (let x = 8; x <= 11; x++) g[14][x] = hair;
      g[12][8] = "#5a2a24";
      g[12][9] = "#5a2a24";
      g[12][10] = "#5a2a24";
      g[12][11] = "#5a2a24";
      if (race === "dwarf") {
        for (let x = 6; x <= 13; x++) {
          g[1][x] = "#9a9aa6";
          g[2][x] = "#7e7e8c";
        }
        g[0][8] = "#c79a45";
        g[0][11] = "#c79a45";
      }
    }
    if (female) {
      for (let y = 4; y <= 13; y++) {
        g[y][5] = hair;
        g[y][14] = hair;
      }
      for (let y = 14; y <= 17; y++) {
        g[y][4] = hair;
        g[y][5] = hair;
        g[y][14] = hair;
        g[y][15] = hair;
      }
      g[16][4] = shade(hair, -12);
      g[16][15] = shade(hair, -12);
      const lip = "#bd5f66";
      g[12][8] = lip;
      g[12][9] = lip;
      g[12][10] = lip;
      g[12][11] = lip;
      g[13][9] = "#a04a52";
      g[13][10] = "#a04a52";
      g[7][7] = shade(hair, -6);
      g[7][12] = shade(hair, -6);
    }
    if (race === "orc" || race === "goblin") {
      g[13][8] = white;
      g[13][11] = white;
    }
    if (sin) {
      g[3][9] = SIN_COLOR[sin] || "#2a2020";
      g[3][10] = SIN_COLOR[sin] || "#2a2020";
    }
    return g;
  } catch {
    for (let y = 3; y <= 13; y++) for (let x = 5; x <= 14; x++) g[y][x] = "#c98d6a";
    g[7][8] = "#2a2020";
    g[7][11] = "#2a2020";
    return g;
  }
}

export function PixelPortrait({
  seed,
  cell = 6,
  race,
  sin,
  gender,
  className,
}: {
  seed: string;
  cell?: number;
  race?: string | null;
  sin?: Sin | null;
  gender?: string | null;
  className?: string;
}) {
  const g = buildPortrait(seed, race ?? undefined, sin ?? undefined, gender ?? undefined);
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
    <div className="flex gap-[2px] rounded-[3px] p-[2px]" style={{ height, background: "#00000012" }}>
      {Array.from({ length: seg }).map((_, i) => (
        <div key={i} className="flex-1 rounded-[1px]" style={{ background: i < filled ? color : track }} />
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
      style={{ width: size, height: size, background: `${color}26`, border: `1.5px solid ${color}`, borderRadius: 3 }}
    >
      <span className="-rotate-45 text-[9px] font-bold leading-none" style={{ color }}>
        {SIN_LABEL_TR[sin][0]}
      </span>
    </span>
  );
}
