import { buildPortrait } from "./pixel";

const cache = new Map<string, (string | null)[][]>();

function grid(seed: string, race?: string | null): (string | null)[][] {
  const k = `${seed}|${race || ""}`;
  let g = cache.get(k);
  if (!g) {
    g = buildPortrait(seed, race || undefined, undefined);
    cache.set(k, g);
  }
  return g;
}

export function drawPortraitToken(
  ctx: CanvasRenderingContext2D,
  seed: string,
  race: string | null | undefined,
  cx: number,
  cy: number,
  d: number,
  ring: string,
  dead = false,
): void {
  const g = grid(seed, race);
  const n = g.length;
  const cell = d / n;
  const x0 = cx - d / 2;
  const y0 = cy - d / 2;
  ctx.save();
  ctx.globalAlpha = dead ? 0.4 : 1;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#141d27";
  ctx.fill();
  ctx.clip();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x0 + x * cell, y0 + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, d * 0.09);
  ctx.strokeStyle = ring;
  ctx.globalAlpha = dead ? 0.5 : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
