export interface HouseDef {
  id: string;
  name: string;
  sprite: string;
  blurb: string;
}

export const HOUSES: HouseDef[] = [
  { id: "kanli_tac", name: "Kanlı Taç", sprite: "hb_kanli_tac", blurb: "Tahtın gerçek sahibi olduğuna inanan kadim kraliyet soyu." },
  { id: "kara_kuzgun", name: "Kara Kuzgun", sprite: "hb_kara_kuzgun", blurb: "Sırlar ve suikastlarla yükselen gölgeler evi." },
  { id: "gumus_kurt", name: "Gümüş Kurt", sprite: "hb_gumus_kurt", blurb: "Kuzeyin sadık savaşçı klanı; sürü asla dağılmaz." },
  { id: "altin_aslan", name: "Altın Aslan", sprite: "hb_altin_aslan", blurb: "Zenginlik ve gururun evi; borçlar daima ödenir." },
  { id: "yesil_yilan", name: "Yeşil Yılan", sprite: "hb_yesil_yilan", blurb: "Zehir ve entrikanın ustaları; her söz iki anlam taşır." },
  { id: "kizil_gul", name: "Kızıl Gül", sprite: "hb_kizil_gul", blurb: "Güzellik ve trajedi; her tacın altında bir diken." },
];

export function houseById(id: string): HouseDef | undefined {
  return HOUSES.find((h) => h.id === id);
}
