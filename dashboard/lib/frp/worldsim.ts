import type { MapData, Tile } from "@/lib/frp/mapgen";

export interface Army {
  house: string;
  q: number;
  r: number;
  target: string;
  siege: number;
}

export interface Caravan {
  q: number;
  r: number;
  to: string;
}

export interface SimState {
  time?: number;
  weather?: string;
  discovered_pois?: string[];
  armies?: Army[];
  caravans?: Caravan[];
  corruption?: string[];
  control?: Record<string, string>;
  seeded?: boolean;
}

export interface SimEvent {
  kind: string;
  text: string;
  house: string | null;
}

const HEX = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function hexDist(aq: number, ar: number, bq: number, br: number): number {
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

function isLand(t: Tile | undefined): boolean {
  return !!t && t.biome !== "water" && t.biome !== "deep_water";
}

function stepToward(map: MapData, tiles: Map<string, Tile>, fq: number, fr: number, tq: number, tr: number): { q: number; r: number } {
  let best: { q: number; r: number } | null = null;
  let bd = hexDist(fq, fr, tq, tr);
  for (const [dq, dr] of HEX) {
    const nq = fq + dq;
    const nr = fr + dr;
    if (!isLand(tiles.get(`${nq},${nr}`))) continue;
    const d = hexDist(nq, nr, tq, tr);
    if (d < bd) {
      bd = d;
      best = { q: nq, r: nr };
    }
  }
  return best || { q: fq, r: fr };
}

function tileMap(map: MapData): Map<string, Tile> {
  const m = new Map<string, Tile>();
  for (const t of map.tiles) m.set(`${t.q},${t.r}`, t);
  return m;
}

function houseOf(house: string): string {
  return { kanli_tac: "Kanlı Taç", kara_kuzgun: "Kara Kuzgun", gumus_kurt: "Gümüş Kurt", altin_aslan: "Altın Aslan", yesil_yilan: "Yeşil Yılan", kizil_gul: "Kızıl Gül" }[house] || house;
}

export function initSim(map: MapData, state: SimState): SimState {
  const capitals = map.pois.filter((p) => p.kind === "capital");
  const markets = map.pois.filter((p) => p.kind === "market");
  const armies: Army[] = [];
  for (let i = 0; i < capitals.length; i++) {
    const cap = capitals[i];
    const foe = capitals[(i + 2) % capitals.length];
    if (!cap.house) continue;
    armies.push({ house: cap.house, q: cap.q, r: cap.r, target: foe.id, siege: 0 });
  }
  const caravans: Caravan[] = markets.slice(0, 3).map((m, i) => ({ q: m.q, r: m.r, to: markets[(i + 1) % markets.length]?.id || m.id }));
  return {
    ...state,
    armies,
    caravans,
    corruption: [],
    control: {},
    seeded: true,
  };
}

export function simTick(map: MapData, state: SimState, seed: number): { state: SimState; events: SimEvent[] } {
  const tiles = tileMap(map);
  const poiById = new Map(map.pois.map((p) => [p.id, p]));
  const events: SimEvent[] = [];
  const control = { ...(state.control || {}) };

  const armies = (state.armies || []).map((a) => ({ ...a }));
  for (const army of armies) {
    const tgt = poiById.get(army.target);
    if (!tgt) continue;
    if (hexDist(army.q, army.r, tgt.q, tgt.r) <= 1) {
      army.siege += 1;
      if (army.siege >= 3) {
        const loser = tgt.house;
        if (loser && loser !== army.house && control[loser] !== army.house) {
          control[loser] = army.house;
          events.push({ kind: "capture", text: `${houseOf(army.house)} orduları ${tgt.name} başkentini düşürdü; ${houseOf(loser)} toprakları el değiştirdi.`, house: army.house });
        }
        army.siege = 0;
        const caps = map.pois.filter((p) => p.kind === "capital" && p.id !== army.target && (control[p.house || ""] || p.house) !== army.house);
        const pick = caps[(seed + army.q) % Math.max(1, caps.length)];
        if (pick) army.target = pick.id;
      }
    } else {
      const nx = stepToward(map, tiles, army.q, army.r, tgt.q, tgt.r);
      army.q = nx.q;
      army.r = nx.r;
      army.siege = 0;
    }
  }

  const caravans = (state.caravans || []).map((c) => ({ ...c }));
  for (const cv of caravans) {
    const tgt = poiById.get(cv.to);
    if (!tgt) continue;
    if (hexDist(cv.q, cv.r, tgt.q, tgt.r) <= 1) {
      const markets = map.pois.filter((p) => p.kind === "market" && p.id !== cv.to);
      const pick = markets[(seed + cv.q + cv.r) % Math.max(1, markets.length)];
      if (pick) cv.to = pick.id;
    } else {
      const nx = stepToward(map, tiles, cv.q, cv.r, tgt.q, tgt.r);
      cv.q = nx.q;
      cv.r = nx.r;
    }
  }

  const corruption = new Set(state.corruption || []);
  const sinSites = map.pois.filter((p) => p.kind === "sin_site");
  for (const s of sinSites) {
    const roll = (Math.imul((seed + s.q * 31 + s.r * 17) | 0, 2246822507) >>> 0) / 4294967296;
    if (roll > 0.5) continue;
    const cands = [`${s.q},${s.r}`, ...HEX.map(([dq, dr]) => `${s.q + dq},${s.r + dr}`)];
    for (const k of cands) {
      if (corruption.has(k)) continue;
      if (isLand(tiles.get(k))) {
        corruption.add(k);
        break;
      }
    }
    for (const k of [...corruption]) {
      const [cq, cr] = k.split(",").map(Number);
      if (hexDist(cq, cr, s.q, s.r) > 6) continue;
      const spreadRoll = (Math.imul((seed + cq * 13 + cr * 7) | 0, 2654435761) >>> 0) / 4294967296;
      if (spreadRoll < 0.25) {
        for (const [dq, dr] of HEX) {
          const nk = `${cq + dq},${cr + dr}`;
          if (!corruption.has(nk) && isLand(tiles.get(nk))) {
            corruption.add(nk);
            break;
          }
        }
      }
    }
  }

  return {
    state: { ...state, armies, caravans, corruption: [...corruption], control },
    events,
  };
}

export function tickWorld(map: MapData, mapState: SimState, seed: number): { mapState: SimState; events: SimEvent[] } {
  let s = mapState;
  if (!s.seeded) s = initSim(map, s);
  const r = simTick(map, s, seed);
  return { mapState: r.state, events: r.events };
}

export function effectiveHouse(control: Record<string, string> | undefined, house: string | null): string | null {
  if (!house) return null;
  return (control && control[house]) || house;
}
