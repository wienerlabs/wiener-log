export interface SceneEvent {
  image: string;
  captureCurrent?: string;
  factionDelta?: Record<string, number>;
  doom?: number;
  news: string;
}

export const SCENE_EVENTS: Record<string, SceneEvent> = {
  kanli_tac_ordu: {
    image: "kanli_tac_ordu",
    factionDelta: { kanli_tac: 4 },
    doom: 2,
    news: "Kanlı Taç ordusu başkentten sefere çıktı; savaş kapıya dayandı.",
  },
  kara_kuzgun_yagma: {
    image: "kara_kuzgun_yagma",
    captureCurrent: "kara_kuzgun",
    factionDelta: { kara_kuzgun: 6, kanli_tac: -2 },
    doom: 5,
    news: "Kara Kuzgun orduları {node} şehrini ateşe verip yağmaladı.",
  },
  yesil_yilan_yenik: {
    image: "yesil_yilan_yenik",
    factionDelta: { yesil_yilan: -7 },
    doom: 4,
    news: "Yeşil Yılan ordusu bir meydanda bozguna uğradı; enkazın ortasında dev bir yaratık uyandı.",
  },
};

export function sceneEvent(key: string | null | undefined): SceneEvent | undefined {
  return key ? SCENE_EVENTS[key] : undefined;
}

export function sceneEventKeys(): string[] {
  return Object.keys(SCENE_EVENTS);
}
