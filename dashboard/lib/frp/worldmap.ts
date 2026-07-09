import type { Sin } from "@/lib/frp/types";

export type NodeKind =
  | "hub"
  | "market"
  | "forge"
  | "wild"
  | "dungeon"
  | "boss"
  | "sanctum";

export interface MapNode {
  key: string;
  name: string;
  kind: NodeKind;
  house?: string;
  sin?: Sin;
  x: number;
  y: number;
  blurb: string;
  image?: string;
  neighbors: string[];
}

export const MAP_VIEW = { w: 320, h: 210 };
export const START_NODE = "ocakkent";

const NODES: MapNode[] = [
  { key: "ocakkent", name: "Ocakkent", kind: "hub", house: "altin_aslan", x: 158, y: 108, image: "big_city", blurb: "Kıtanın kalbindeki surlu başkent; tüm yollar buraya çıkar.", neighbors: ["pazarkasabasi", "kozdemirhanesi", "sisorman", "karagecit", "kizil_iskele", "batik_mahzen"] },
  { key: "pazarkasabasi", name: "Pazar Kasabası", kind: "market", house: "yesil_yilan", x: 96, y: 72, image: "market_square", blurb: "Her şeyin alınıp satıldığı, her sözün iki anlam taşıdığı çarşı.", neighbors: ["ocakkent", "durgun_kule", "obur_batakligi", "sisorman"] },
  { key: "kozdemirhanesi", name: "Köz Demirhanesi", kind: "forge", house: "gumus_kurt", x: 216, y: 66, image: "blacksmith", blurb: "Çekiç sesinin hiç dinmediği dağ eteği demirhanesi.", neighbors: ["ocakkent", "kul_tahti", "karagecit"] },
  { key: "sisorman", name: "Sisorman", kind: "wild", house: "kizil_gul", sin: "envy", x: 66, y: 146, blurb: "Ağaçların arasından hep bir çift gözün izlediği sisli orman.", neighbors: ["ocakkent", "pazarkasabasi", "durgun_kule"] },
  { key: "karagecit", name: "Kara Geçit", kind: "dungeon", house: "kara_kuzgun", x: 250, y: 142, image: "outer_gate", blurb: "Suikastçıların ve kaçakçıların gölgede kaldığı sınır geçidi.", neighbors: ["ocakkent", "kozdemirhanesi", "batik_mahzen", "koz_colu"] },
  { key: "kizil_iskele", name: "Kızıl İskele", kind: "market", house: "kizil_gul", sin: "lust", x: 150, y: 182, blurb: "Şarabın ve sırların aktığı liman; her gemi bir dedikodu getirir.", neighbors: ["ocakkent", "obur_batakligi"] },
  { key: "obur_batakligi", name: "Obur Bataklığı", kind: "wild", sin: "gluttony", x: 78, y: 30, blurb: "Ne düşerse yutan, dibi görünmeyen açgözlü bataklık.", neighbors: ["pazarkasabasi", "durgun_kule", "kizil_iskele"] },
  { key: "kul_tahti", name: "Kül Tahtı", kind: "boss", house: "kanli_tac", sin: "pride", x: 280, y: 40, image: "great_hall", blurb: "Kadim kraliyet soyunun yıkık tahtı; kibir burada taş kesilir.", neighbors: ["kozdemirhanesi", "koz_colu"] },
  { key: "durgun_kule", name: "Durgun Kule", kind: "sanctum", sin: "sloth", x: 36, y: 78, image: "watchtower", blurb: "Zamanın ağır aktığı, saatlerin durduğu yalnız kule.", neighbors: ["pazarkasabasi", "sisorman", "obur_batakligi"] },
  { key: "koz_colu", name: "Köz Çölü", kind: "wild", sin: "wrath", x: 286, y: 176, blurb: "Öfkenin kavurduğu, gökten kül yağan kızgın çöl.", neighbors: ["karagecit", "kul_tahti"] },
  { key: "batik_mahzen", name: "Batık Mahzen", kind: "dungeon", sin: "greed", x: 214, y: 118, image: "courtyard", blurb: "Altına boğulup sulara gömülen bir hanedanın hazine mahzeni.", neighbors: ["ocakkent", "karagecit"] },
];

export const WORLD_MAP: Record<string, MapNode> = Object.fromEntries(
  NODES.map((n) => [n.key, n]),
);

export const MAP_NODES = NODES;

export function nodeByKey(key: string | null | undefined): MapNode | undefined {
  return key ? WORLD_MAP[key] : undefined;
}

export function areNeighbors(a: string, b: string): boolean {
  return !!WORLD_MAP[a]?.neighbors.includes(b);
}

export const KIND_TR: Record<NodeKind, string> = {
  hub: "Başkent",
  market: "Pazar",
  forge: "Demirhane",
  wild: "Yaban",
  dungeon: "Zindan",
  boss: "Yuva",
  sanctum: "Tapınak",
};

export function isMarket(kind: NodeKind | undefined): boolean {
  return kind === "market" || kind === "hub";
}

export function isForge(kind: NodeKind | undefined): boolean {
  return kind === "forge" || kind === "hub";
}
