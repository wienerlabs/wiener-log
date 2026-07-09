import type { Stats } from "@/lib/frp/types";

export interface ClassDef {
  id: string;
  name: string;
  blurb: string;
  sprite: string;
  hp: number;
  mp: number;
  stats: Stats;
  items: string[];
  ability: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: "warrior",
    name: "Warrior",
    blurb: "Steel and scars. Holds the line when others break.",
    sprite: "cls_warrior",
    hp: 34,
    mp: 6,
    stats: { str: 15, dex: 11, con: 14, int: 8, wis: 10, cha: 10 },
    items: ["sword", "shield", "potion_health", "bread"],
    ability: "Shield Wall",
  },
  {
    id: "mage",
    name: "Mage",
    blurb: "Reads the seams of the world and pulls them apart.",
    sprite: "cls_mage",
    hp: 20,
    mp: 22,
    stats: { str: 8, dex: 10, con: 10, int: 16, wis: 13, cha: 11 },
    items: ["staff", "scroll", "potion_mana", "torch"],
    ability: "Arcane Bolt",
  },
  {
    id: "rogue",
    name: "Rogue",
    blurb: "A shadow with a grudge and a very sharp answer.",
    sprite: "cls_rogue",
    hp: 24,
    mp: 10,
    stats: { str: 10, dex: 16, con: 11, int: 12, wis: 10, cha: 13 },
    items: ["dagger", "dagger", "potion_health", "key"],
    ability: "Backstab",
  },
  {
    id: "ranger",
    name: "Ranger",
    blurb: "Keeps the wilds at arm's length, arrow already nocked.",
    sprite: "cls_ranger",
    hp: 26,
    mp: 12,
    stats: { str: 11, dex: 15, con: 12, int: 10, wis: 13, cha: 9 },
    items: ["bow", "arrows", "dagger", "potion_health"],
    ability: "Aimed Shot",
  },
  {
    id: "cleric",
    name: "Cleric",
    blurb: "Carries a fading light into places that swallow it.",
    sprite: "cls_cleric",
    hp: 28,
    mp: 18,
    stats: { str: 12, dex: 9, con: 13, int: 11, wis: 16, cha: 12 },
    items: ["staff", "shield", "potion_health", "scroll"],
    ability: "Mend Wounds",
  },
  {
    id: "warlock",
    name: "Warlock",
    blurb: "Made a bargain in the dark. The dark keeps the receipt.",
    sprite: "cls_warlock",
    hp: 22,
    mp: 20,
    stats: { str: 9, dex: 11, con: 11, int: 15, wis: 10, cha: 15 },
    items: ["staff", "gem", "potion_mana", "ring"],
    ability: "Hex",
  },
  {
    id: "assassin",
    name: "Assassin",
    blurb: "A debt collector for the grave. Never seen, only felt.",
    sprite: "cls_assassin",
    hp: 22,
    mp: 10,
    stats: { str: 10, dex: 17, con: 11, int: 11, wis: 10, cha: 12 },
    items: ["dagger", "dagger", "potion_health", "key"],
    ability: "Shadow Strike",
  },
  {
    id: "tamer",
    name: "Shapeshifter",
    blurb: "Wears other shapes and speaks the tongue of beasts.",
    sprite: "cls_tamer",
    hp: 26,
    mp: 16,
    stats: { str: 11, dex: 12, con: 13, int: 13, wis: 15, cha: 11 },
    items: ["staff", "dagger", "potion_health", "bread"],
    ability: "Summon Beast",
  },
  {
    id: "necromancer",
    name: "Necromancer",
    blurb: "Death is not an ending here, only a change of employer.",
    sprite: "cls_necromancer",
    hp: 20,
    mp: 22,
    stats: { str: 8, dex: 10, con: 11, int: 16, wis: 13, cha: 13 },
    items: ["staff", "gem", "scroll", "ring"],
    ability: "Raise Dead",
  },
];

export interface RaceDef {
  id: string;
  name: string;
  blurb: string;
  mods: Partial<Stats>;
}

export const RACES: RaceDef[] = [
  { id: "human", name: "Human", blurb: "Adaptable, stubborn, everywhere.", mods: { str: 1, cha: 1 } },
  { id: "half_elf", name: "Half-elf", blurb: "Belongs to two worlds, trusted by neither.", mods: { dex: 1, cha: 1 } },
  { id: "dwarf", name: "Dwarf", blurb: "Deep roots, deeper grudges.", mods: { con: 2 } },
  { id: "orc", name: "Orc", blurb: "Feared first, understood rarely.", mods: { str: 2 } },
  { id: "elf", name: "Elf", blurb: "Long memory, longer patience.", mods: { dex: 1, int: 1 } },
  { id: "tiefling", name: "Tiefling", blurb: "Born marked, already half-accused.", mods: { int: 1, cha: 1 } },
  { id: "goblin", name: "Goblin", blurb: "Small, sharp, and underestimated to the last.", mods: { dex: 2 } },
];

export const CLASS_COIN: Record<string, number> = {
  warrior: 40,
  mage: 60,
  rogue: 85,
  ranger: 50,
  cleric: 45,
  warlock: 55,
  assassin: 90,
  tamer: 40,
  necromancer: 55,
};

export const RACE_ITEMS: Record<string, string[]> = {
  human: ["bread"],
  half_elf: ["scroll"],
  elf: ["arrows"],
  dwarf: ["mace"],
  orc: ["greatsword"],
  goblin: ["dagger"],
  tiefling: ["gem"],
};

export function classById(id: string): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}
export function raceById(id: string): RaceDef | undefined {
  return RACES.find((r) => r.id === id);
}

export const CLASS_TR: Record<string, { name: string; blurb: string; ability: string }> = {
  warrior: { name: "Savaşçı", blurb: "Çelik ve yaralar. Diğerleri kırılınca safı o tutar.", ability: "Kalkan Duvarı" },
  mage: { name: "Büyücü", blurb: "Dünyanın dikişlerini okur ve söker.", ability: "Arkan Oku" },
  rogue: { name: "Hırsız", blurb: "Kinli bir gölge ve çok keskin bir yanıt.", ability: "Sırttan Bıçak" },
  ranger: { name: "Avcı", blurb: "Vahşi doğayı bir kol boyu uzakta tutar, oku hep gergin.", ability: "Nişanlı Atış" },
  cleric: { name: "Rahip", blurb: "Sönmekte olan bir ışığı, onu yutan yerlere taşır.", ability: "Yara Sarma" },
  warlock: { name: "Efsuncu", blurb: "Karanlıkta bir pazarlık yaptı. Karanlık makbuzu saklıyor.", ability: "Lanet" },
  assassin: { name: "Suikastçı", blurb: "Mezarın tahsildarı. Görülmez, yalnızca hissedilir.", ability: "Gölge Darbesi" },
  tamer: { name: "Şekil Değiştiren", blurb: "Başka bedenlere bürünür, canavarların dilini konuşur.", ability: "Canavar Çağır" },
  necromancer: { name: "Nekromant", blurb: "Ölüm burada bir son değil, sadece patron değiştirmektir.", ability: "Ölüyü Dirilt" },
};

export const RACE_TR: Record<string, { name: string; blurb: string }> = {
  human: { name: "İnsan", blurb: "Uyumlu, inatçı, her yerde." },
  half_elf: { name: "Yarı-elf", blurb: "İki dünyaya ait, hiçbirine güvenilmez." },
  dwarf: { name: "Cüce", blurb: "Derin kökler, daha derin kinler." },
  orc: { name: "Ork", blurb: "Önce korkulur, nadiren anlaşılır." },
  elf: { name: "Elf", blurb: "Uzun hafıza, daha uzun sabır." },
  tiefling: { name: "Tiefling", blurb: "Damgalı doğar, yarı-suçlanmış." },
  goblin: { name: "Goblin", blurb: "Küçük, sivri ve hep hafife alınan." },
};
