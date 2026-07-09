export type Biome =
  | "deep_water"
  | "water"
  | "beach"
  | "plains"
  | "forest"
  | "hills"
  | "mountain"
  | "desert"
  | "swamp"
  | "snow"
  | "tundra"
  | "wasteland";

export type Theme = "normal" | "frozen" | "drowned" | "wartorn";

export type PoiKind =
  | "start"
  | "capital"
  | "market"
  | "forge"
  | "dungeon"
  | "boss"
  | "sanctum"
  | "wild"
  | "sin_site"
  | "wonder";

export interface Tile {
  col: number;
  row: number;
  q: number;
  r: number;
  biome: Biome;
  elevation: number;
  moisture: number;
  temperature: number;
  danger: number;
  river: boolean;
  region: string | null;
  poi: string | null;
}

export interface Poi {
  id: string;
  kind: PoiKind;
  name: string;
  q: number;
  r: number;
  col: number;
  row: number;
  house?: string;
  sin?: string;
  blurb: string;
  hidden?: boolean;
}

export interface MapData {
  seed: string;
  theme: Theme;
  cols: number;
  rows: number;
  sea: number;
  start: { q: number; r: number };
  tiles: Tile[];
  pois: Poi[];
}

const COLS = 48;
const ROWS = 34;

const HOUSES = ["kanli_tac", "kara_kuzgun", "gumus_kurt", "altin_aslan", "yesil_yilan", "kizil_gul"];
const SINS = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"];

const SIN_ALTAR: Record<string, string> = {
  pride: "Kibir Sunağı",
  greed: "Açgözlülük Mahzeni",
  lust: "Şehvet Tapınağı",
  envy: "Haset Gölü",
  gluttony: "Oburluk Çukuru",
  wrath: "Gazap Yarığı",
  sloth: "Durgunluk Kulesi",
};

const WONDERS = [
  "Dev Uçurum",
  "Tanrı Leşi",
  "Küllerin Kulesi",
  "Boğulmuş Katedral",
  "Kırık Ay Taşı",
  "Sonsuz Merdiven",
  "Ağlayan Kaya",
  "Yıldız Çukuru",
];

const ONSET = ["Ka", "Kor", "Val", "Dra", "Mor", "Se", "Tor", "Ael", "Bre", "Kra", "Vel", "Gor", "Han", "Sur", "Kul", "Ash", "Nar", "Tal", "Var", "Ered", "Cel", "Dun"];
const CODA = ["kent", "burg", "hold", "gard", "var", "han", "tepe", "kale", "köy", "dor", "mir", "hal", "geçit", "ova", "surlar", "pınar"];

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseField(seed: number) {
  const h = (x: number, y: number) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const v00 = h(x0, y0);
    const v10 = h(x0 + 1, y0);
    const v01 = h(x0, y0 + 1);
    const v11 = h(x0 + 1, y0 + 1);
    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
  };
  return (x: number, y: number, octaves = 4, freq = 1) => {
    let amp = 1;
    let f = freq;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * at(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

function offToAxial(col: number, row: number): { q: number; r: number } {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

function hexDist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

const ODDR: number[][][] = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

function offNeighbors(col: number, row: number): { col: number; row: number }[] {
  const set = ODDR[row & 1];
  const out: { col: number; row: number }[] = [];
  for (const [dc, dr] of set) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) out.push({ col: c, row: r });
  }
  return out;
}

function placeName(rng: () => number): string {
  const a = ONSET[Math.floor(rng() * ONSET.length)];
  const b = CODA[Math.floor(rng() * CODA.length)];
  const mid = rng() < 0.4 ? ONSET[Math.floor(rng() * ONSET.length)].toLowerCase() : "";
  return a + mid + b;
}

function pickTheme(rng: () => number, forced?: Theme): Theme {
  if (forced) return forced;
  const pool: Theme[] = ["normal", "normal", "normal", "frozen", "drowned", "wartorn"];
  return pool[Math.floor(rng() * pool.length)];
}

function classify(e: number, m: number, t: number, sea: number): Biome {
  if (e < sea - 0.06) return "deep_water";
  if (e < sea) return "water";
  if (e < sea + 0.02) return "beach";
  if (e > 0.84) return "mountain";
  if (e > 0.7) return "hills";
  if (t < 0.26) return m > 0.4 ? "snow" : "tundra";
  if (t > 0.72 && m < 0.32) return "desert";
  if (m > 0.66) return t > 0.45 ? "swamp" : "forest";
  if (m > 0.42) return "forest";
  return "plains";
}

const BIOME_DANGER: Record<Biome, number> = {
  deep_water: 30,
  water: 14,
  beach: 5,
  plains: 5,
  forest: 12,
  hills: 18,
  mountain: 35,
  desert: 28,
  swamp: 30,
  snow: 32,
  tundra: 22,
  wasteland: 46,
};

export function generateMap(seed: string, opts: { theme?: Theme } = {}): MapData {
  const base = hashSeed(seed || "wiener");
  const rng = mulberry32(base);
  const theme = pickTheme(rng, opts.theme);
  const sea = theme === "drowned" ? 0.5 : 0.4;

  const elevN = noiseField(base ^ 0x9e3779b1);
  const moistN = noiseField(base ^ 0x85ebca77);
  const tempN = noiseField(base ^ 0xc2b2ae3d);
  const warN = noiseField(base ^ 0x27d4eb2f);

  const cx = COLS / 2;
  const cy = ROWS / 2;
  const maxD = Math.hypot(cx, cy);

  const tiles: Tile[] = new Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const nx = (col / COLS) * 6;
      const ny = (row / ROWS) * 6;
      let e = elevN(nx, ny, 5, 1);
      const d = Math.hypot(col - cx, row - cy) / maxD;
      const falloff = Math.max(0, (d - 0.55) / 0.45);
      e -= falloff * falloff * 0.7;
      e = Math.max(0, Math.min(1, e));

      let m = moistN(nx + 11, ny + 7, 4, 1.3);
      let t = tempN(nx + 3, ny + 19, 3, 0.9);
      t = t * 0.7 + (1 - row / ROWS) * 0.3;
      if (theme === "frozen") t = Math.max(0, t - 0.28);
      if (theme === "drowned") m = Math.min(1, m + 0.2);

      let biome = classify(e, m, t, sea);
      if (theme === "wartorn" && biome !== "deep_water" && biome !== "water" && biome !== "beach") {
        if (warN(nx + 31, ny + 41, 3, 1.6) > 0.62) biome = "wasteland";
      }
      const ax = offToAxial(col, row);
      tiles[row * COLS + col] = {
        col,
        row,
        q: ax.q,
        r: ax.r,
        biome,
        elevation: e,
        moisture: m,
        temperature: t,
        danger: 0,
        river: false,
        region: null,
        poi: null,
      };
    }
  }

  const isLand = (tl: Tile) => tl.biome !== "deep_water" && tl.biome !== "water";

  const sourceCount = 8;
  let placedSources = 0;
  for (let tries = 0; tries < 400 && placedSources < sourceCount; tries++) {
    const col = Math.floor(rng() * COLS);
    const row = Math.floor(rng() * ROWS);
    const tl = tiles[row * COLS + col];
    if (tl.elevation < 0.6 || tl.elevation > 0.85 || tl.moisture < 0.5 || !isLand(tl)) continue;
    placedSources++;
    let cur = tl;
    for (let step = 0; step < 60; step++) {
      cur.river = true;
      if (cur.biome === "water" || cur.biome === "deep_water") break;
      let next: Tile | null = null;
      for (const nb of offNeighbors(cur.col, cur.row)) {
        const cand = tiles[nb.row * COLS + nb.col];
        if (!next || cand.elevation < next.elevation) next = cand;
      }
      if (!next || next.elevation >= cur.elevation - 0.001) break;
      cur = next;
    }
  }

  const landTiles = tiles.filter(isLand);

  const findStart = (): Tile => {
    let best: Tile | null = null;
    for (const tl of landTiles) {
      if (tl.biome !== "plains" && tl.biome !== "hills" && tl.biome !== "beach") continue;
      const dc = Math.hypot(tl.col - cx, tl.row - cy);
      if (!best || dc < Math.hypot(best.col - cx, best.row - cy)) best = tl;
    }
    return best || landTiles[0];
  };
  const startTile = findStart();
  const startAx = { q: startTile.q, r: startTile.r };

  const pois: Poi[] = [];
  const usedNames = new Set<string>();
  const uniqueName = (): string => {
    for (let i = 0; i < 30; i++) {
      const n = placeName(rng);
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
    return placeName(rng) + Math.floor(rng() * 90);
  };

  const spacedFrom = (tl: Tile, min: number) =>
    pois.every((p) => hexDist({ q: p.q, r: p.r }, { q: tl.q, r: tl.r }) >= min);

  const shuffledLand = [...landTiles];
  for (let i = shuffledLand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffledLand[i];
    shuffledLand[i] = shuffledLand[j];
    shuffledLand[j] = tmp;
  }

  const capitals: Poi[] = [];
  const tryCapitals = (ok: (tl: Tile) => boolean, minSpace: number) => {
    for (const tl of shuffledLand) {
      if (capitals.length >= HOUSES.length) break;
      if (tl.poi || !ok(tl)) continue;
      if (hexDist(startAx, { q: tl.q, r: tl.r }) < 4) continue;
      if (!capitals.every((c) => hexDist({ q: c.q, r: c.r }, { q: tl.q, r: tl.r }) >= minSpace)) continue;
      const house = HOUSES[capitals.length];
      const poi: Poi = { id: `capital-${capitals.length}`, kind: "capital", name: uniqueName(), q: tl.q, r: tl.r, col: tl.col, row: tl.row, house, blurb: "Bir hanedanın taht şehri." };
      capitals.push(poi);
      pois.push(poi);
      tl.poi = poi.id;
    }
  };
  tryCapitals((tl) => tl.biome === "plains" || tl.biome === "hills", 8);
  tryCapitals((tl) => tl.biome !== "mountain", 5);
  tryCapitals(() => true, 3);

  for (const tl of landTiles) {
    let nearest: Poi | null = null;
    let nd = Infinity;
    for (const cap of capitals) {
      const dd = hexDist({ q: cap.q, r: cap.r }, { q: tl.q, r: tl.r });
      if (dd < nd) {
        nd = dd;
        nearest = cap;
      }
    }
    tl.region = nearest?.house ?? null;
  }

  const nearMountain = (tl: Tile) => offNeighbors(tl.col, tl.row).some((n) => tiles[n.row * COLS + n.col].biome === "mountain") || tl.biome === "hills";

  const addPoi = (kind: PoiKind, tl: Tile, name: string, blurb: string, extra: Partial<Poi> = {}): Poi => {
    const poi: Poi = { id: `${kind}-${pois.length}`, kind, name, q: tl.q, r: tl.r, col: tl.col, row: tl.row, blurb, ...extra };
    pois.push(poi);
    tl.poi = poi.id;
    return poi;
  };

  const startPoi = addPoi("start", startTile, "Ocakkent", "Yolculuğun başladığı sığınak kasaba.");
  void startPoi;

  const placeKind = (kind: PoiKind, count: number, ok: (tl: Tile) => boolean, minSpace: number, blurb: string, extra?: (i: number) => Partial<Poi>) => {
    let n = 0;
    for (const tl of shuffledLand) {
      if (n >= count) break;
      if (tl.poi || !ok(tl) || !spacedFrom(tl, minSpace)) continue;
      addPoi(kind, tl, uniqueName(), blurb, extra ? extra(n) : {});
      n++;
    }
  };

  placeKind("market", 4, (tl) => (tl.biome === "plains" || tl.biome === "beach") && capitals.some((c) => hexDist({ q: c.q, r: c.r }, { q: tl.q, r: tl.r }) <= 4), 4, "Alışverişin ve söylentinin döndüğü pazar.");
  placeKind("forge", 2, (tl) => nearMountain(tl) && (tl.biome === "hills" || tl.biome === "plains"), 6, "Çekiç sesinin dinmediği demirhane.");
  placeKind("wild", 3, (tl) => tl.biome === "forest" || tl.biome === "desert", 5, "Kanunun ulaşmadığı yaban.");
  placeKind("dungeon", 3, (tl) => tl.biome === "mountain" || tl.biome === "swamp", 6, "Karanlık ve tehlike dolu bir delik.");
  placeKind("sanctum", 1, (tl) => (tl.biome === "snow" || tl.biome === "tundra" || tl.biome === "mountain") && hexDist(startAx, { q: tl.q, r: tl.r }) > 9, 6, "Zamanın ağır aktığı yalnız tapınak.");

  const ensure = (kind: PoiKind, min: number, ok: (tl: Tile) => boolean, blurb: string) => {
    for (const space of [4, 2, 1]) {
      let need = min - pois.filter((p) => p.kind === kind).length;
      if (need <= 0) return;
      for (const tl of shuffledLand) {
        if (need <= 0) break;
        if (tl.poi || !ok(tl) || !spacedFrom(tl, space)) continue;
        addPoi(kind, tl, uniqueName(), blurb);
        need--;
      }
    }
  };
  ensure("dungeon", 3, (tl) => tl.elevation > sea + 0.04 && tl.biome !== "beach", "Karanlık ve tehlike dolu bir delik.");
  ensure("forge", 2, (tl) => tl.elevation > sea + 0.02 && tl.biome !== "beach", "Çekiç sesinin dinmediği demirhane.");
  ensure("wild", 3, (tl) => tl.biome === "forest" || tl.biome === "desert" || tl.biome === "swamp" || tl.biome === "plains", "Kanunun ulaşmadığı yaban.");

  let bossTile: Tile | null = null;
  for (const tl of landTiles) {
    if (tl.poi) continue;
    if (tl.biome !== "mountain" && tl.biome !== "wasteland") continue;
    const dd = hexDist(startAx, { q: tl.q, r: tl.r });
    if (dd < 10) continue;
    if (!bossTile || dd > hexDist(startAx, { q: bossTile.q, r: bossTile.r })) bossTile = tl;
  }
  if (bossTile) addPoi("boss", bossTile, "Kül Tahtı", "Kadim bir dehşetin yuvası.");

  const sinCandidates = [...landTiles]
    .filter((tl) => !tl.poi && hexDist(startAx, { q: tl.q, r: tl.r }) > 8)
    .sort((a, b) => hexDist(startAx, { q: b.q, r: b.r }) - hexDist(startAx, { q: a.q, r: a.r }));
  let si = 0;
  for (const tl of sinCandidates) {
    if (si >= SINS.length) break;
    if (tl.poi || !spacedFrom(tl, 5)) continue;
    const sin = SINS[si];
    addPoi("sin_site", tl, SIN_ALTAR[sin], "Bir günah silahının uyuduğu lanetli mekan.", { sin, hidden: true });
    si++;
  }

  const dramatic = [...landTiles].sort((a, b) => b.elevation - a.elevation);
  let wi = 0;
  for (const tl of dramatic) {
    if (wi >= 3) break;
    if (tl.poi || !spacedFrom(tl, 6)) continue;
    addPoi("wonder", tl, WONDERS[Math.floor(rng() * WONDERS.length)], "Efsanelere geçmiş bir dünya harikası.", { hidden: true });
    wi++;
  }

  const sinSites = pois.filter((p) => p.kind === "sin_site");
  let maxStartDist = 1;
  for (const tl of tiles) maxStartDist = Math.max(maxStartDist, hexDist(startAx, { q: tl.q, r: tl.r }));
  for (const tl of tiles) {
    let dg = (hexDist(startAx, { q: tl.q, r: tl.r }) / maxStartDist) * 55;
    dg += BIOME_DANGER[tl.biome];
    let sinD = Infinity;
    for (const s of sinSites) sinD = Math.min(sinD, hexDist({ q: s.q, r: s.r }, { q: tl.q, r: tl.r }));
    if (sinD < 4) dg += (4 - sinD) * 8;
    if (theme === "wartorn") dg += 15;
    if (theme === "drowned") dg += 5;
    tl.danger = Math.max(0, Math.min(100, Math.round(dg)));
  }

  return { seed: seed || "wiener", theme, cols: COLS, rows: ROWS, sea, start: startAx, tiles, pois };
}
