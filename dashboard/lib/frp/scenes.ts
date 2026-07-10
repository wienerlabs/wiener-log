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
  kizil_gul_sehri: {
    image: "kizil_gul_sehri",
    factionDelta: { kizil_gul: 6, kanli_tac: -1 },
    doom: 3,
    news: "Kızıl Gül'ün başkenti bin bir gülle taçlanıp kapılarını ardına dek açtı; güzelliğin ardında dikenler bileniyor.",
  },
  gumus_kurt_suru: {
    image: "gumus_kurt_suru",
    factionDelta: { gumus_kurt: 6 },
    doom: 2,
    news: "Gümüş Kurt sürüsü kuzey geçidinde toplandı; sürü uludu, kar kana bulanmaya hazırlanıyor.",
  },
  altin_aslan_ordu: {
    image: "altin_aslan_ordu",
    factionDelta: { altin_aslan: 6, kizil_gul: -1 },
    doom: 3,
    news: "Altın Aslan orduları altın sancaklarla şafağa yürüdü; her borç bugün kanla ödenecek.",
  },
};

export function sceneEvent(key: string | null | undefined): SceneEvent | undefined {
  return key ? SCENE_EVENTS[key] : undefined;
}

export function sceneEventKeys(): string[] {
  return Object.keys(SCENE_EVENTS);
}
