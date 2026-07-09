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
];

export function locationByKey(k: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.key === k);
}

export function locationsForPrompt(): string {
  return LOCATIONS.map((l) => `${l.key} (${l.hint})`).join("; ");
}
