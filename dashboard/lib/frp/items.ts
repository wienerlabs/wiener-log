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
  { id: "arrows", name: "Arrows", rarity: "common", category: "consumable", sprite: "it_arrows", desc: "A quiver of arrows. A bow is dead weight without them." },
  { id: "mace", name: "Mace", rarity: "common", category: "weapon", sprite: "it_mace", desc: "Blunt honesty for armored problems." },
  { id: "spear", name: "Spear", rarity: "common", category: "weapon", sprite: "it_spear", desc: "Reach the enemy before the enemy reaches you." },
  { id: "greatsword", name: "Greatsword", rarity: "uncommon", category: "weapon", sprite: "it_sword", desc: "Two hands, one terrible arc." },
  { id: "crossbow", name: "Crossbow", rarity: "uncommon", category: "weapon", sprite: "it_bow", desc: "Slow to load, quick to end things. Needs bolts." },
  { id: "warhammer", name: "Warhammer", rarity: "uncommon", category: "weapon", sprite: "it_mace", desc: "Turns plate into a problem for the wearer." },
  { id: "rapier", name: "Rapier", rarity: "uncommon", category: "weapon", sprite: "it_dagger", desc: "A duelist's needle; finds the gap in any guard." },
  { id: "chain_armor", name: "Chain Mail", rarity: "uncommon", category: "armor", sprite: "it_armor", desc: "Rings of iron. Worn, it turns blades aside." },
  { id: "plate_armor", name: "Plate Armor", rarity: "rare", category: "armor", sprite: "it_armor", desc: "A wall you can walk in. Heavy, and it can break." },
];

export function coinBreakdown(copper: number): { gold: number; silver: number; copper: number } {
  const c = Math.max(0, Math.round(copper || 0));
  return { gold: Math.floor(c / 100), silver: Math.floor((c % 100) / 10), copper: c % 10 };
}

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
  arrows: "Oklar",
  mace: "Gürz",
  spear: "Mızrak",
  greatsword: "Pala",
  crossbow: "Arbalet",
  warhammer: "Savaş Çekici",
  rapier: "Meç",
  chain_armor: "Zincir Zırh",
  plate_armor: "Plaka Zırh",
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

const ITEM_DESC_TR: Record<string, string> = {
  sword: "Dürüst çelik. Yakın dövüşte güvenilir hasar.",
  dagger: "Sessiz ve hızlı. Gizli saldırılarda üstün.",
  bow: "Uzaktan isabetli atış. Menzil avantajı sağlar.",
  staff: "Büyü kanalı. Büyü gücünü artırır.",
  shield: "Gelen darbeleri savuşturur. Savunmayı yükseltir.",
  leather_armor: "Hafif koruma. Hareketi kısıtlamaz.",
  potion_health: "Yaraları kapatır, canı geri verir.",
  potion_mana: "Zihnin ardındaki kuyuyu doldurur, manayı yeniler.",
  scroll: "Tek seferlik bir büyü ya da sır taşır.",
  torch: "Karanlığı bir kol boyu uzakta tutar.",
  key: "Bir kilidi veya bir sırrı açar.",
  bread: "Bayat ama doyurucu. Yolda güç verir.",
  ring: "Sıcak dokunuşlu gümüş bir yüzük. Gizli bir güç barındırır.",
  gem: "Geri bakan kızıl bir taş. Değeri ve tehlikesi büyük.",
  gold_pouch: "İnsanı değiştirecek ağırlıkta altın.",
  arrows: "Bir sadak dolusu ok. Yay onlarsız ölü ağırlıktır.",
  mace: "Zırhlı sorunlara küt bir dürüstlük.",
  spear: "Düşman sana ulaşmadan sen ona uzan.",
  greatsword: "İki el, tek korkunç yay.",
  crossbow: "Yavaş dolar, hızlı bitirir. Cıvata ister.",
  warhammer: "Plakayı, giyenin sorununa çevirir.",
  rapier: "Düellocunun iğnesi; her siperin açığını bulur.",
  chain_armor: "Demir halkalar. Giyilince bıçağı savurur.",
  plate_armor: "İçinde yürüdüğün bir duvar. Ağır ve kırılabilir.",
  sin_pride: "İki elli kılıç. Kullanıcı kendini ne kadar üstün görürse o kadar keskinleşir. Kibir yozlaştırır.",
  sin_greed: "Zincirli tırpan. Kurbanının en değerli özelliğini çalar. Açgözlülük yozlaştırır.",
  sin_lust: "İkiz hançer. Dokunduğu herkesin iradesini zayıflatır. Şehvet yozlaştırır.",
  sin_envy: "Uzun yay. Karşısındakinin en güçlü yeteneğini kopyalar. Haset yozlaştırır.",
  sin_gluttony: "Devasa balta. Öldürdüğü her şeyi yutarak büyür. Oburluk yozlaştırır.",
  sin_wrath: "Savaş eldivenleri. Aldığı her yarayla güçlenir. Öfke yozlaştırır.",
  sin_sloth: "Zamanı yavaşlatan asa. Nihai gücü Sessiz Dünya. Tembellik yozlaştırır.",
};

export function itemDescTr(id: string): string {
  return ITEM_DESC_TR[id] || ITEM_CATALOG[id]?.desc || "";
}

export const RARITY_TR: Record<Rarity, string> = {
  common: "sıradan",
  uncommon: "az bulunur",
  rare: "nadir",
  epic: "destansı",
  legendary: "efsanevi",
};

const PRICES: Record<string, number> = {
  bread: 8,
  torch: 10,
  arrows: 25,
  potion_health: 40,
  potion_mana: 45,
  scroll: 90,
  key: 50,
  dagger: 60,
  shield: 90,
  leather_armor: 80,
  spear: 100,
  mace: 110,
  sword: 120,
  staff: 120,
  bow: 130,
  rapier: 230,
  crossbow: 240,
  warhammer: 250,
  greatsword: 260,
  chain_armor: 220,
  plate_armor: 520,
  ring: 400,
  gem: 350,
};

export function itemPrice(id: string): number {
  return PRICES[id] ?? 0;
}

export function sellPrice(id: string): number {
  return Math.floor(itemPrice(id) * 0.4);
}

export function priceWithDoom(base: number, doom: number): number {
  return Math.round(base * (1 + Math.max(0, Math.min(100, doom)) / 250));
}

export const MARKET_STOCK: string[] = [
  "potion_health",
  "potion_mana",
  "bread",
  "torch",
  "arrows",
  "scroll",
  "key",
  "dagger",
  "sword",
  "spear",
  "mace",
  "bow",
  "staff",
  "shield",
  "leather_armor",
];

export const FORGE_STOCK: string[] = [
  "chain_armor",
  "plate_armor",
  "greatsword",
  "crossbow",
  "warhammer",
  "rapier",
  "shield",
];

export interface ForgeUpgrade {
  from: string;
  to: string;
  cost: number;
}

export const FORGE_UPGRADES: ForgeUpgrade[] = [
  { from: "sword", to: "greatsword", cost: 140 },
  { from: "dagger", to: "rapier", cost: 170 },
  { from: "mace", to: "warhammer", cost: 140 },
  { from: "bow", to: "crossbow", cost: 110 },
  { from: "leather_armor", to: "chain_armor", cost: 140 },
  { from: "chain_armor", to: "plate_armor", cost: 300 },
];
