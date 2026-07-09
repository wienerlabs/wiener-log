import type { ReactNode } from "react";
import { PALETTE, SPRITES } from "@/lib/frp/sprites";
import { SIN_COLOR, SIN_LABEL } from "@/lib/frp/items";
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
      const ch = rows[y][x];
      const color = PALETTE[ch];
      if (!color || color === "transparent") continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * cell}
          y={y * cell}
          width={cell}
          height={cell}
          fill={color}
        />,
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
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const SKINS = ["#d7a583", "#9c6b47", "#e8b98f", "#c68642", "#8d5524", "#a9b7c6"];
const HAIRS = ["#0d1117", "#4a3218", "#6e4b2a", "#8b949e", "#f0c040", "#da3633", "#a371f7"];
const EYES = ["#2f81f7", "#3fb950", "#6e4b2a", "#010409", "#a371f7"];

function buildPortrait(seed: string, sin?: Sin): (string | null)[][] {
  const hs = hashSeed(seed);
  const skin = SKINS[hs % SKINS.length];
  const hair = HAIRS[(hs >> 3) % HAIRS.length];
  const eye = sin ? SIN_COLOR[sin] : EYES[(hs >> 7) % EYES.length];
  const beard = ((hs >> 11) & 1) === 1;
  const style = (hs >> 13) % 3;
  const dark = shade(skin, -26);
  const N = 12;
  const g: (string | null)[][] = Array.from({ length: N }, () =>
    Array(N).fill(null),
  );
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
  if (beard) {
    for (let y = 7; y <= 10; y++) for (let x = 3; x <= 8; x++) g[y][x] = hair;
    g[8][5] = "#5a3a2f";
    g[8][6] = "#5a3a2f";
  }
  g[11][5] = skin;
  g[11][6] = skin;
  if (sin) {
    g[1][5] = SIN_COLOR[sin];
    g[1][6] = SIN_COLOR[sin];
  }
  return g;
}

export function PixelPortrait({
  seed,
  cell = 7,
  sin,
  className,
}: {
  seed: string;
  cell?: number;
  sin?: Sin | null;
  className?: string;
}) {
  const g = buildPortrait(seed, sin ?? undefined);
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
}: {
  value: number;
  max: number;
  color: string;
  seg?: number;
  height?: number;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const filled = Math.round(ratio * seg);
  return (
    <div className="flex gap-[2px]" style={{ height }}>
      {Array.from({ length: seg }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ background: i < filled ? color : "#21262d", height }}
        />
      ))}
    </div>
  );
}

export function SinSigil({ sin, size = 16 }: { sin: Sin; size?: number }) {
  const color = SIN_COLOR[sin];
  return (
    <span
      title={SIN_LABEL[sin]}
      className="inline-flex shrink-0 rotate-45 items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        borderRadius: 3,
      }}
    >
      <span
        className="-rotate-45 text-[9px] font-bold leading-none"
        style={{ color }}
      >
        {SIN_LABEL[sin][0]}
      </span>
    </span>
  );
}
