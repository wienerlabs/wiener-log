import { ITEM_CATALOG } from "@/lib/frp/items";
import type { ItemDef, Rarity } from "@/lib/frp/items";
import type { MapData } from "@/lib/frp/mapgen";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANK: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
type Cat = "weapon" | "armor" | "consumable" | "treasure" | "misc";
const CATS: Cat[] = ["weapon", "armor", "consumable", "treasure", "misc"];

const ALL = Object.values(ITEM_CATALOG) as (ItemDef & { rarity: Rarity; sin?: string })[];
function pool(cat: Cat, rmax: number): string[] {
  return ALL.filter((i) => (i.category as string) === cat && RANK[i.rarity] <= rmax && !i.sin).map((i) => i.id);
}
const SIN_IDS = ALL.filter((i) => i.sin).map((i) => i.id);

export interface LootSite {
  q: number;
  r: number;
  tier: number;
}

function axDist(aq: number, ar: number, bq: number, br: number): number {
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

export function lootSites(map: MapData): LootSite[] {
  const rnd = mulberry32(hash(`${map.seed}:loot:v1`));
  const land = map.tiles.filter(
    (t) => t.biome !== "deep_water" && t.biome !== "water" && !t.poi,
  );
  const order = land
    .map((t) => ({ t, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
  const sites: LootSite[] = [];
  const target = 16 + Math.floor(rnd() * 8);
  const minSpace = 3;
  for (const t of order) {
    if (sites.length >= target) break;
    if (axDist(t.q, t.r, map.start.q, map.start.r) < 2) continue;
    if (sites.some((s) => axDist(s.q, s.r, t.q, t.r) < minSpace)) continue;
    const d = t.danger;
    const wilderness = axDist(t.q, t.r, map.start.q, map.start.r) > 14;
    const tier = d >= 70 && wilderness ? 4 : d >= 55 ? 3 : d >= 28 ? 2 : 1;
    sites.push({ q: t.q, r: t.r, tier });
  }
  return sites;
}

export function lootSiteAt(map: MapData, key: string): LootSite | null {
  const [q, r] = key.split(",").map(Number);
  return lootSites(map).find((s) => s.q === q && s.r === r) || null;
}

const CAT_WEIGHT: Record<number, Record<Cat, number>> = {
  1: { weapon: 2, armor: 1, consumable: 5, treasure: 2, misc: 3 },
  2: { weapon: 3, armor: 2, consumable: 4, treasure: 3, misc: 2 },
  3: { weapon: 3, armor: 3, consumable: 3, treasure: 4, misc: 1 },
  4: { weapon: 4, armor: 3, consumable: 2, treasure: 5, misc: 1 },
};

function pickWeighted(rnd: () => number, weights: Record<Cat, number>): Cat {
  const total = CATS.reduce((s, c) => s + weights[c], 0);
  let r = rnd() * total;
  for (const c of CATS) {
    r -= weights[c];
    if (r <= 0) return c;
  }
  return "consumable";
}

export function rollLoot(seed: string, q: number, r: number, tier: number): { items: string[]; gold: number } {
  const rnd = mulberry32(hash(`${seed}:${q},${r}:loot:v1`));
  const rmax = tier >= 4 ? 3 : tier === 3 ? 3 : tier === 2 ? 2 : 1;
  const count = tier >= 4 ? 3 + Math.floor(rnd() * 2) : tier === 3 ? 2 + Math.floor(rnd() * 2) : tier === 2 ? 2 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);
  const weights = CAT_WEIGHT[tier] || CAT_WEIGHT[1];
  const items: string[] = [];
  const usedCat = new Set<Cat>();
  for (let i = 0; i < count; i++) {
    let cat = pickWeighted(rnd, weights);
    if (usedCat.has(cat) && cat !== "consumable" && rnd() < 0.7) cat = pickWeighted(rnd, weights);
    let p = pool(cat, rmax);
    if (!p.length) p = pool("consumable", rmax);
    if (!p.length) continue;
    usedCat.add(cat);
    items.push(p[Math.floor(rnd() * p.length)]);
  }
  if (tier >= 4 && SIN_IDS.length && rnd() < 0.14) items.push(SIN_IDS[Math.floor(rnd() * SIN_IDS.length)]);
  const base = tier === 4 ? 60 : tier === 3 ? 34 : tier === 2 ? 18 : 8;
  const gold = base + Math.floor(rnd() * base * 1.5);
  return { items, gold };
}
