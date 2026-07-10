export interface LocationDef {
  key: string;
  tr: string;
  en: string;
  hint: string;
  big?: boolean;
}

export const LOCATIONS: LocationDef[] = [
  {
    key: "big_city",
    tr: "Büyük Şehir",
    en: "the great walled city",
    hint: "the sprawling capital: a great castle on a hill above a walled town, market, river and bridge",
    big: true,
  },
  { key: "outer_gate", tr: "Dış Kapı", en: "the outer gate", hint: "a fortified castle gate guarded by soldiers" },
  { key: "courtyard", tr: "Avlu", en: "the courtyard", hint: "an inner castle courtyard with troops" },
  { key: "great_hall", tr: "Büyük Salon", en: "the great hall", hint: "a torchlit throne room or great hall" },
  { key: "blacksmith", tr: "Demirci", en: "the blacksmith", hint: "a blacksmith's forge and anvil" },
  { key: "market_square", tr: "Pazar Meydanı", en: "the market square", hint: "a busy market square of tents and stalls" },
  { key: "watchtower", tr: "Gözcü Kulesi", en: "a watchtower", hint: "a lone stone watchtower on a hill" },
  {
    key: "kanli_tac_ordu",
    tr: "Kanlı Taç Ordusu Sefere Çıkıyor",
    en: "the Blood Crown army marching to war",
    hint: "a vast army under blood-red banners crowned in gold, a mounted king leading it out from the capital toward another house's lands for war",
    big: true,
  },
  {
    key: "kara_kuzgun_yagma",
    tr: "Kara Kuzgun Bir Şehri Yağmalıyor",
    en: "the Raven army sacking a burning city",
    hint: "the Kara Kuzgun (Raven) host under black raven banners storming and burning a city, a crowned rider raising his sword amid the sack",
    big: true,
  },
  {
    key: "yesil_yilan_yenik",
    tr: "Yeşil Yılan Ordusu Bozguna Uğradı",
    en: "the Serpent army routed, a great beast in the square",
    hint: "a plaza strewn with fallen Yeşil Yılan (Serpent) soldiers under green banners, a colossal chained serpent-beast risen at its center",
    big: true,
  },
  {
    key: "kizil_gul_sehri",
    tr: "Kızıl Gül'ün Başkenti Çiçek Açtı",
    en: "the Red Rose capital in crimson bloom",
    hint: "the Kızıl Gül (Red Rose) capital at dusk: crimson walls and rose-red towers, a colossal blooming red rose emblem over the gate, banners and thorned rose vines beneath a pale moon",
    big: true,
  },
  {
    key: "gumus_kurt_suru",
    tr: "Gümüş Kurt Sürüsü Kuzeyde Toplandı",
    en: "the Silver Wolf pack mustering in the north",
    hint: "the Gümüş Kurt (Silver Wolf) fortress in a snowbound northern night: slate-blue walls and towers, a silver wolf emblem over the gate, pine forest and snowdrifts under an aurora and a pale moon",
    big: true,
  },
  {
    key: "altin_aslan_ordu",
    tr: "Altın Aslan Orduları Yürüyüşe Geçti",
    en: "the Golden Lion host marching at dawn",
    hint: "the Altın Aslan (Golden Lion) citadel at dawn: golden sandstone walls lit with gold, a radiant lion emblem over the gate, gold pennants and sunburst rays, wealth spilling in the streets",
    big: true,
  },
];

export function locationByKey(k: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.key === k);
}

export function locationsForPrompt(): string {
  return LOCATIONS.map((l) => `${l.key} (${l.hint})`).join("; ");
}
