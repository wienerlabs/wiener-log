import type { Sin } from "@/lib/frp/types";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ItemCategory =
  | "weapon"
  | "armor"
  | "consumable"
  | "treasure"
  | "misc";

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  category: ItemCategory;
  sprite: string;
  desc: string;
  sin?: Sin;
  ability?: string;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#8b949e",
  uncommon: "#3fb950",
  rare: "#2f81f7",
  epic: "#a371f7",
  legendary: "#d29922",
};

const COMMON: ItemDef[] = [
  { id: "sword", name: "Iron Sword", rarity: "common", category: "weapon", sprite: "it_sword", desc: "Honest steel, honestly worn." },
  { id: "dagger", name: "Dagger", rarity: "common", category: "weapon", sprite: "it_dagger", desc: "Quiet, quick, deniable." },
  { id: "bow", name: "Hunting Bow", rarity: "common", category: "weapon", sprite: "it_bow", desc: "Feeds you or defends you." },
  { id: "staff", name: "Oak Staff", rarity: "common", category: "weapon", sprite: "it_staff", desc: "A conduit for those who can hear the world hum." },
  { id: "shield", name: "Round Shield", rarity: "uncommon", category: "armor", sprite: "it_shield", desc: "Between you and the next mistake." },
  { id: "leather_armor", name: "Leather Armor", rarity: "common", category: "armor", sprite: "it_armor", desc: "Cheap, quiet, better than nothing." },
  { id: "potion_health", name: "Health Draught", rarity: "common", category: "consumable", sprite: "it_potion_red", desc: "Closes wounds. Tastes of copper." },
  { id: "potion_mana", name: "Mana Draught", rarity: "common", category: "consumable", sprite: "it_potion_blue", desc: "Refills the well behind your eyes." },
  { id: "scroll", name: "Sealed Scroll", rarity: "uncommon", category: "consumable", sprite: "it_scroll", desc: "Someone wanted this read only once." },
  { id: "torch", name: "Torch", rarity: "common", category: "misc", sprite: "it_torch", desc: "Holds the dark one arm's length away." },
  { id: "key", name: "Rusted Key", rarity: "uncommon", category: "misc", sprite: "it_key", desc: "Opens something. Or someone's memory." },
  { id: "bread", name: "Trail Bread", rarity: "common", category: "consumable", sprite: "it_bread", desc: "Stale, filling, loyal." },
  { id: "ring", name: "Silver Ring", rarity: "rare", category: "treasure", sprite: "it_ring", desc: "Warm to the touch. It should not be." },
  { id: "gem", name: "Bloodstone", rarity: "rare", category: "treasure", sprite: "it_gem", desc: "A red that watches back." },
  { id: "gold_pouch", name: "Coin Pouch", rarity: "common", category: "treasure", sprite: "it_coin", desc: "Heavy in the way that changes people." },
];

export const SIN_WEAPONS: ItemDef[] = [
  {
    id: "sin_pride",
    name: "Heaven's Verdict",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_pride",
    sin: "pride",
    ability: "Absolute Supremacy",
    desc: "A two-handed sword. The surer the wielder is of their own greatness, the sharper it cuts.",
  },
  {
    id: "sin_greed",
    name: "Chain of Ownership",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_greed",
    sin: "greed",
    ability: "The Usurper",
    desc: "A chained scythe that steals what its victims value most.",
  },
  {
    id: "sin_lust",
    name: "Crimson Serenade",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_lust",
    sin: "lust",
    ability: "Seducing Blood",
    desc: "Twin daggers that thin the will of anyone they taste.",
  },
  {
    id: "sin_envy",
    name: "Reflected Fate",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_envy",
    sin: "envy",
    ability: "The Mimic's Arrow",
    desc: "A longbow that copies the strongest gift of whatever it faces.",
  },
  {
    id: "sin_gluttony",
    name: "Eternal Hunger",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_gluttony",
    sin: "gluttony",
    ability: "The Devouring Void",
    desc: "A monstrous war axe that grows by eating everything it kills.",
  },
  {
    id: "sin_wrath",
    name: "Calamity's Fist",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_wrath",
    sin: "wrath",
    ability: "Wrath Accrued",
    desc: "Great war gauntlets that grow stronger with every wound taken.",
  },
  {
    id: "sin_sloth",
    name: "Staff of Endless Twilight",
    rarity: "legendary",
    category: "weapon",
    sprite: "sin_sloth",
    sin: "sloth",
    ability: "Field of Stillness",
    desc: "A staff that slows time itself. Its final word is a Silent World.",
  },
];

const ALL = [...COMMON, ...SIN_WEAPONS];
export const ITEM_CATALOG: Record<string, ItemDef> = Object.fromEntries(
  ALL.map((i) => [i.id, i]),
);

export function itemById(id: string): ItemDef | undefined {
  return ITEM_CATALOG[id];
}

export const SIN_LABEL: Record<Sin, string> = {
  pride: "Pride",
  greed: "Greed",
  lust: "Lust",
  envy: "Envy",
  gluttony: "Gluttony",
  wrath: "Wrath",
  sloth: "Sloth",
};

export const SIN_COLOR: Record<Sin, string> = {
  pride: "#b0863a",
  greed: "#4a7a3a",
  lust: "#b85450",
  envy: "#3a6a5a",
  gluttony: "#8a5a9a",
  wrath: "#b0483f",
  sloth: "#5f7cb4",
};

export const SIN_LABEL_TR: Record<Sin, string> = {
  pride: "Kibir",
  greed: "Açgözlülük",
  lust: "Şehvet",
  envy: "Haset",
  gluttony: "Oburluk",
  wrath: "Öfke",
  sloth: "Tembellik",
};

const ITEM_NAME_TR: Record<string, string> = {
  sword: "Demir Kılıç",
  dagger: "Hançer",
  bow: "Av Yayı",
  staff: "Meşe Asa",
  shield: "Yuvarlak Kalkan",
  leather_armor: "Deri Zırh",
  potion_health: "Şifa İksiri",
  potion_mana: "Mana İksiri",
  scroll: "Mühürlü Parşömen",
  torch: "Meşale",
  key: "Paslı Anahtar",
  bread: "Yol Ekmeği",
  ring: "Gümüş Yüzük",
  gem: "Kan Taşı",
  gold_pouch: "Altın Kese",
  sin_pride: "Göklerin Hükmü",
  sin_greed: "Mülkiyet Zinciri",
  sin_lust: "Kızıl Serenat",
  sin_envy: "Yansıyan Yazgı",
  sin_gluttony: "Ebedi Açlık",
  sin_wrath: "Felaketin Yumruğu",
  sin_sloth: "Sonsuz Alacakaranlık Asası",
};

export function itemNameTr(id: string): string {
  return ITEM_NAME_TR[id] || ITEM_CATALOG[id]?.name || id;
}

export const RARITY_TR: Record<Rarity, string> = {
  common: "sıradan",
  uncommon: "az bulunur",
  rare: "nadir",
  epic: "destansı",
  legendary: "efsanevi",
};
