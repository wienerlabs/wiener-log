import { generateMap } from "../lib/frp/mapgen.ts";

const BIOME_CH = {
  deep_water: " ",
  water: ".",
  beach: "_",
  plains: '"',
  forest: "T",
  hills: "n",
  mountain: "^",
  desert: ":",
  swamp: "%",
  snow: "*",
  tundra: ",",
  wasteland: "#",
};
const POI_CH = {
  start: "@",
  capital: "C",
  market: "$",
  forge: "F",
  dungeon: "D",
  boss: "B",
  sanctum: "S",
  wild: "w",
  sin_site: "!",
  wonder: "W",
};

function preview(map) {
  const byRC = new Map(map.tiles.map((t) => [t.row * map.cols + t.col, t]));
  const poiAt = new Map(map.pois.map((p) => [p.row * map.cols + p.col, p]));
  const lines = [];
  for (let row = 0; row < map.rows; row++) {
    let line = row & 1 ? " " : "";
    for (let col = 0; col < map.cols; col++) {
      const t = byRC.get(row * map.cols + col);
      const p = poiAt.get(row * map.cols + col);
      line += p ? POI_CH[p.kind] : t.river ? "~" : BIOME_CH[t.biome];
      line += " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else console.log("ok:", msg);
}

const a1 = generateMap("alpha");
const a2 = generateMap("alpha");
const b1 = generateMap("beta");

assert(JSON.stringify(a1) === JSON.stringify(a2), "same seed -> identical map (deterministic)");
assert(JSON.stringify(a1.tiles.map((t) => t.biome)) !== JSON.stringify(b1.tiles.map((t) => t.biome)), "different seed -> different map");

const counts = (m) => {
  const c = {};
  for (const p of m.pois) c[p.kind] = (c[p.kind] || 0) + 1;
  return c;
};
const c = counts(a1);
assert(c.capital === 6, `6 capitals (got ${c.capital})`);
assert(c.start === 1, `1 start (got ${c.start})`);
assert(c.sin_site === 7, `7 sin sites (got ${c.sin_site})`);
assert((c.wonder || 0) >= 1, `>=1 wonder (got ${c.wonder})`);
assert((c.dungeon || 0) >= 1 && (c.market || 0) >= 1, "has dungeons and markets");
assert(a1.tiles.every((t) => t.danger >= 0 && t.danger <= 100), "danger in 0..100");
assert(a1.tiles.filter((t) => t.region).length > 200, "regions assigned to land");
assert(["normal", "frozen", "drowned", "wartorn"].includes(a1.theme), `valid theme (${a1.theme})`);

const land = a1.tiles.filter((t) => t.biome !== "deep_water" && t.biome !== "water").length;
const rivers = a1.tiles.filter((t) => t.river).length;
console.log(`\nseed=alpha theme=${a1.theme} land=${land}/${a1.tiles.length} rivers=${rivers} pois=${a1.pois.length} ${JSON.stringify(c)}`);
console.log(preview(a1));

console.log(`\n--- beta (theme=${b1.theme}) ---`);
console.log(preview(b1));

const themes = new Set();
let minDungeon = 99;
let minForge = 99;
let minCap = 99;
for (let i = 0; i < 40; i++) {
  const m = generateMap("s" + i);
  themes.add(m.theme);
  const cc = counts(m);
  minDungeon = Math.min(minDungeon, cc.dungeon || 0);
  minForge = Math.min(minForge, cc.forge || 0);
  minCap = Math.min(minCap, cc.capital || 0);
}
console.log("\nthemes seen across 40 seeds:", [...themes].join(", "));
assert(minCap === 6, `every seed has 6 capitals (min ${minCap})`);
assert(minDungeon >= 2, `every seed has >=2 dungeons (min ${minDungeon})`);
assert(minForge >= 1, `every seed has >=1 forge (min ${minForge})`);
