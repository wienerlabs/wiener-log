import { neighbors, axialDistance, offsetToAxial, axialToOffset, key, parseKey } from "./hex";
import type { BattleArena, ArenaTerrain, Enemy } from "./types";

function hashSeed(str: string): number {
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

export const TERRAIN_TR: Record<ArenaTerrain, string> = {
  rock: "kaya",
  tree: "ağaç",
  water: "su",
  high: "yükselti",
  ember: "köz",
};

export function terrainCost(t: ArenaTerrain | undefined): number {
  if (t === "rock") return Infinity;
  if (t === "tree" || t === "water" || t === "high" || t === "ember") return 2;
  return 1;
}

export function terrainBlocks(t: ArenaTerrain | undefined): boolean {
  return t === "rock";
}

export function isCover(t: ArenaTerrain | undefined): boolean {
  return t === "tree" || t === "rock";
}

export function isHighGround(t: ArenaTerrain | undefined): boolean {
  return t === "high";
}

function biomeTerrain(biome: string, rnd: () => number): ArenaTerrain {
  const r = rnd();
  switch (biome) {
    case "forest":
    case "swamp":
      return r < 0.55 ? "tree" : r < 0.75 ? "water" : r < 0.9 ? "rock" : "high";
    case "mountain":
    case "hills":
      return r < 0.45 ? "rock" : r < 0.8 ? "high" : "tree";
    case "desert":
    case "wasteland":
      return r < 0.5 ? "rock" : r < 0.72 ? "high" : "ember";
    case "snow":
    case "tundra":
      return r < 0.5 ? "rock" : r < 0.82 ? "high" : "tree";
    case "water":
    case "deep_water":
    case "beach":
      return r < 0.6 ? "water" : r < 0.85 ? "rock" : "tree";
    default:
      return r < 0.42 ? "tree" : r < 0.68 ? "rock" : r < 0.88 ? "high" : "water";
  }
}

export function arenaCells(w: number, h: number): string[] {
  const out: string[] = [];
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++) {
      const a = offsetToAxial(col, row);
      out.push(key(a.q, a.r));
    }
  return out;
}

export function inArena(arena: { w: number; h: number }, k: string): boolean {
  const { q, r } = parseKey(k);
  const off = axialToOffset(q, r);
  return off.col >= 0 && off.col < arena.w && off.row >= 0 && off.row < arena.h;
}

function colOf(k: string): number {
  const { q, r } = parseKey(k);
  return axialToOffset(q, r).col;
}

function spaced<T>(arr: T[], i: number, n: number): T {
  if (!arr.length) return arr[0];
  const idx = Math.floor(((i + 0.5) * arr.length) / Math.max(1, n));
  return arr[Math.min(arr.length - 1, idx)];
}

export function genArena(
  seed: string,
  campaignId: number,
  round: number,
  biome: string,
  partyHandles: string[],
  enemyCount: number,
): BattleArena {
  const rnd = mulberry32(hashSeed(`${seed}:${campaignId}:${round}:battle`));
  const bodies = partyHandles.length + enemyCount;
  const w = Math.min(11, Math.max(8, 7 + Math.ceil(bodies / 3)));
  const h = 7;
  const cells = arenaCells(w, h);
  const terrain: Record<string, ArenaTerrain> = {};
  for (const k of cells) {
    const col = colOf(k);
    if (col <= 1 || col >= w - 2) continue;
    if (rnd() < 0.22) terrain[k] = biomeTerrain(biome, rnd);
  }
  const leftFree = cells.filter((k) => colOf(k) <= 1 && !terrain[k]);
  const rightFree = cells.filter((k) => colOf(k) >= w - 2 && !terrain[k]);
  const party: Record<string, string> = {};
  partyHandles.forEach((hnd, i) => {
    party[hnd] = spaced(leftFree, i, partyHandles.length);
  });
  const enemies: string[] = [];
  const usedRight = new Set<string>();
  for (let i = 0; i < enemyCount; i++) {
    let cell = spaced(rightFree, i, enemyCount);
    if (usedRight.has(cell)) {
      const alt = rightFree.find((k) => !usedRight.has(k));
      if (alt) cell = alt;
    }
    usedRight.add(cell);
    enemies.push(cell);
  }
  return { w, h, biome, terrain, party, enemies };
}

export function occupied(arena: BattleArena, exclude?: string): Set<string> {
  const s = new Set<string>();
  for (const v of Object.values(arena.party)) if (v && v !== exclude) s.add(v);
  for (const v of arena.enemies) if (v && v !== exclude) s.add(v);
  return s;
}

export function arenaReachable(arena: BattleArena, fromKey: string, budget: number): Map<string, number> {
  const dist = new Map<string, number>([[fromKey, 0]]);
  const blocked = occupied(arena, fromKey);
  const queue: [string, number][] = [[fromKey, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[1] - b[1]);
    const [cur, d] = queue.shift()!;
    if (d > (dist.get(cur) ?? Infinity)) continue;
    const { q, r } = parseKey(cur);
    for (const nb of neighbors(q, r)) {
      const nk = key(nb.q, nb.r);
      if (!inArena(arena, nk)) continue;
      if (blocked.has(nk)) continue;
      const t = arena.terrain[nk];
      if (terrainBlocks(t)) continue;
      const nd = d + terrainCost(t);
      if (nd <= budget && nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        queue.push([nk, nd]);
      }
    }
  }
  dist.delete(fromKey);
  return dist;
}

export function battleMoveBudget(cls: string, cls2?: string | null): number {
  const fast = ["rogue", "ranger", "scout", "hızlı"];
  const has = (c?: string | null) => (c ? fast.includes(c.toLowerCase()) : false);
  return 4 + (has(cls) || has(cls2) ? 2 : 0);
}

function dirLabel(from: string, to: string): string {
  const a = axialToOffset(parseKey(from).q, parseKey(from).r);
  const b = axialToOffset(parseKey(to).q, parseKey(to).r);
  const dc = b.col - a.col;
  const dr = b.row - a.row;
  const v = dr < 0 ? "üst" : dr > 0 ? "alt" : "";
  const hh = dc < 0 ? "sol" : dc > 0 ? "sağ" : "";
  if (v && hh) return `${v} ${hh}`;
  return v || hh || "aynı hiza";
}

export function battleContext(arena: BattleArena, actorHandle: string, enemies: Enemy[]): string {
  const pos = arena.party[actorHandle];
  if (!pos) return "";
  const lines: string[] = [];
  const myT = arena.terrain[pos];
  const myGround = isHighGround(myT) ? "yükseltide (isabet avantajı)" : isCover(myT) ? `siperde (${TERRAIN_TR[myT!]})` : "açık alanda";
  lines.push(`Konumun: ${myGround}.`);
  const live = enemies
    .map((e, i) => ({ e, i, k: arena.enemies[i] }))
    .filter((x) => x.e.hp > 0 && x.k);
  if (!live.length) return lines.join(" ");
  const withDist = live
    .map((x) => ({ ...x, d: axialDistance(parseKey(pos), parseKey(x.k)) }))
    .sort((a, b) => a.d - b.d);
  for (const x of withDist.slice(0, 6)) {
    const cover = isCover(arena.terrain[x.k]) ? ", siperde" : isHighGround(arena.terrain[x.k]) ? ", yükseltide" : "";
    const range = x.d <= 1 ? "bitişik (yakın dövüş menzilinde)" : `${x.d} altıgen ötede (${dirLabel(pos, x.k)})`;
    lines.push(`${x.e.name}: ${range}${cover}.`);
  }
  const adj = withDist.filter((x) => x.d <= 1).length;
  lines.push(adj ? `${adj} düşman yakın dövüş menzilinde; menzilli saldırı için uzaktakileri hedefle.` : "Hiçbir düşman bitişik değil; yaklaşman ya da menzilli saldırman gerek.");
  return lines.join(" ");
}

export function stepEnemies(arena: BattleArena, enemies: Enemy[], seed: string, round: number): string[] {
  const partyKeys = Object.values(arena.party).filter(Boolean);
  if (!partyKeys.length) return arena.enemies;
  const rnd = mulberry32(hashSeed(`${seed}:${round}:enemystep`));
  const next = [...arena.enemies];
  const taken = new Set<string>([...partyKeys]);
  for (let i = 0; i < next.length; i++) taken.add(next[i]);
  for (let i = 0; i < next.length; i++) {
    const e = enemies[i];
    if (!e || e.hp <= 0 || !next[i]) continue;
    const cur = next[i];
    const target = partyKeys
      .map((pk) => ({ pk, d: axialDistance(parseKey(cur), parseKey(pk)) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!target || target.d <= 1) continue;
    const { q, r } = parseKey(cur);
    const opts = neighbors(q, r)
      .map((nb) => key(nb.q, nb.r))
      .filter((nk) => inArena(arena, nk) && !terrainBlocks(arena.terrain[nk]) && !taken.has(nk))
      .map((nk) => ({ nk, d: axialDistance(parseKey(nk), parseKey(target.pk)), c: terrainCost(arena.terrain[nk]) + rnd() * 0.1 }))
      .sort((a, b) => a.d - b.d || a.c - b.c);
    if (opts.length && opts[0].d < target.d) {
      taken.delete(cur);
      taken.add(opts[0].nk);
      next[i] = opts[0].nk;
    }
  }
  return next;
}

export function ensureParty(arena: BattleArena, handles: string[]): BattleArena {
  const party: Record<string, string> = {};
  const taken = new Set<string>(arena.enemies.filter(Boolean));
  for (const h of handles)
    if (arena.party[h]) {
      party[h] = arena.party[h];
      taken.add(arena.party[h]);
    }
  const cells = arenaCells(arena.w, arena.h);
  for (const h of handles) {
    if (party[h]) continue;
    const free =
      cells.find((k) => colOf(k) <= 1 && !taken.has(k) && !terrainBlocks(arena.terrain[k])) ||
      cells.find((k) => !taken.has(k) && !terrainBlocks(arena.terrain[k])) ||
      cells[0];
    party[h] = free;
    taken.add(free);
  }
  return { ...arena, party };
}

export function reconcileArena(arena: BattleArena, enemyCount: number): BattleArena {
  if (arena.enemies.length === enemyCount) return arena;
  const cells = arenaCells(arena.w, arena.h);
  const taken = occupied(arena);
  const enemies = arena.enemies.slice(0, enemyCount);
  while (enemies.length < enemyCount) {
    const free = cells.find((k) => colOf(k) >= arena.w - 2 && !taken.has(k) && !terrainBlocks(arena.terrain[k]));
    const cell = free || cells.find((k) => !taken.has(k) && !terrainBlocks(arena.terrain[k])) || cells[0];
    taken.add(cell);
    enemies.push(cell);
  }
  return { ...arena, enemies };
}
