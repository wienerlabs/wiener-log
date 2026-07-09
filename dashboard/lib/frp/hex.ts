export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);

export function axialToPixel(q: number, r: number, size: number): Point {
  return { x: size * (SQRT3 * q + (SQRT3 / 2) * r), y: size * (1.5 * r) };
}

export function axialRound(q: number, r: number): Axial {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

export function pixelToAxial(x: number, y: number, size: number): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return axialRound(q, r);
}

const DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function neighbors(q: number, r: number): Axial[] {
  return DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function axialDistance(a: Axial, b: Axial): number {
  return (
    Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)
  ) / 2;
}

export function axialRange(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const lo = Math.max(-radius, -dq - radius);
    const hi = Math.min(radius, -dq + radius);
    for (let dr = lo; dr <= hi; dr++) out.push({ q: center.q + dq, r: center.r + dr });
  }
  return out;
}

export function axialLine(a: Axial, b: Axial): Axial[] {
  const n = axialDistance(a, b);
  if (n === 0) return [{ ...a }];
  const out: Axial[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(axialRound(a.q + (b.q - a.q) * t, a.r + (b.r - a.r) * t));
  }
  return out;
}

export function offsetToAxial(col: number, row: number): Axial {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

export function axialToOffset(q: number, r: number): { col: number; row: number } {
  const col = q + (r - (r & 1)) / 2;
  return { col, row: r };
}

export function key(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseKey(k: string): Axial {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
}
