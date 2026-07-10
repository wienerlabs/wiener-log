import type { MapData, Tile } from "@/lib/frp/mapgen";

export type Mount = "horse" | "boat" | null;

const LAND_COST: Record<string, number> = {
  beach: 1,
  plains: 1,
  tundra: 1,
  snow: 2,
  forest: 2,
  hills: 2,
  desert: 2,
  wasteland: 2,
  swamp: 3,
  mountain: 3,
};

export function terrainCost(biome: string, mount: Mount): number {
  const water = biome === "water" || biome === "deep_water";
  if (mount === "boat") return water ? 1 : Infinity;
  if (water) return Infinity;
  const c = LAND_COST[biome] ?? 2;
  return mount === "horse" ? Math.max(1, c - 1) : c;
}

export function moveBudget(cls: string, cls2: string | null, mount: Mount): number {
  let b = 4;
  if (mount === "horse") b += 3;
  if (mount === "boat") b = 6;
  if (cls === "ranger" || cls2 === "ranger") b += 1;
  return b;
}

export function visionRadius(tile: Tile | undefined, cls: string, cls2: string | null, night: boolean): number {
  let v = 2;
  if (tile && (tile.biome === "hills" || tile.biome === "mountain")) v += 1;
  if (cls === "ranger" || cls2 === "ranger") v += 1;
  if (night) v -= 1;
  return Math.max(1, v);
}

const HEX_DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function tileMap(map: MapData): Map<string, Tile> {
  const m = new Map<string, Tile>();
  for (const t of map.tiles) m.set(`${t.q},${t.r}`, t);
  return m;
}

export function reachable(map: MapData, fromKey: string, budget: number, mount: Mount): Map<string, number> {
  const tiles = tileMap(map);
  const dist = new Map<string, number>([[fromKey, 0]]);
  const frontier: [number, string][] = [[0, fromKey]];
  while (frontier.length) {
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i][0] < frontier[bi][0]) bi = i;
    const [d, k] = frontier.splice(bi, 1)[0];
    if (d > (dist.get(k) ?? Infinity)) continue;
    const [q, r] = k.split(",").map(Number);
    for (const [dq, dr] of HEX_DIRS) {
      const nk = `${q + dq},${r + dr}`;
      const nt = tiles.get(nk);
      if (!nt) continue;
      const c = terrainCost(nt.biome, mount);
      if (!isFinite(c)) continue;
      const nd = d + c;
      if (nd <= budget && nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        frontier.push([nd, nk]);
      }
    }
  }
  dist.delete(fromKey);
  return dist;
}

export function hexDistanceKey(a: string, b: string): number {
  const [aq, ar] = a.split(",").map(Number);
  const [bq, br] = b.split(",").map(Number);
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

export function hexesWithin(map: MapData, centerKey: string, radius: number): string[] {
  const [cq, cr] = centerKey.split(",").map(Number);
  const out: string[] = [];
  for (const t of map.tiles) {
    const d = (Math.abs(t.q - cq) + Math.abs(t.q + t.r - cq - cr) + Math.abs(t.r - cr)) / 2;
    if (d <= radius) out.push(`${t.q},${t.r}`);
  }
  return out;
}

export interface Clock {
  time: number;
  weather: string;
  discovered_pois: string[];
}

const WEATHERS = ["clear", "clear", "clear", "cloud", "fog", "rain", "storm"];

export function isNight(time: number): boolean {
  const h = ((time % 24) + 24) % 24;
  return h >= 20 || h < 6;
}

export function weatherLabel(w: string): string {
  return { clear: "açık", cloud: "bulutlu", fog: "sisli", rain: "yağmurlu", storm: "fırtınalı", snow: "karlı" }[w] || w;
}

export function biomeLabel(biome: string): string {
  return {
    deep_water: "derin su",
    water: "su",
    beach: "kumsal",
    plains: "ova",
    forest: "orman",
    hills: "tepeler",
    mountain: "dağlar",
    desert: "çöl",
    swamp: "bataklık",
    snow: "kar",
    tundra: "tundra",
    wasteland: "çorak toprak",
  }[biome] || biome;
}

export function timeLabel(time: number): string {
  const h = Math.floor(((time % 24) + 24) % 24);
  const band = h < 6 ? "gece" : h < 12 ? "sabah" : h < 18 ? "öğleden sonra" : h < 20 ? "akşam" : "gece";
  return `${String(h).padStart(2, "0")}:00 ${band}`;
}

export function advanceClock(clock: Clock, hours: number, seed: number): Clock {
  const time = (clock.time || 6) + hours;
  let weather = clock.weather || "clear";
  const roll = (Math.imul((Math.floor(time / 3) + seed) | 0, 2654435761) >>> 0) / 4294967296;
  if (Math.floor(time / 3) !== Math.floor((clock.time || 6) / 3)) {
    weather = WEATHERS[Math.floor(roll * WEATHERS.length)];
  }
  return { time, weather, discovered_pois: clock.discovered_pois || [] };
}
