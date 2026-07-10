import { axialRange, axialLine, key, parseKey, axialDistance } from "./hex";
import { terrainBlocks } from "./battle";
import type { BattleArena } from "./types";

export type AbilityKind = "attack" | "spell" | "heal" | "buff";
export type AbilityTarget = "enemy" | "ally" | "self";

export interface StatusApply {
  id: string;
  label: string;
  turns: number;
}

export interface Ability {
  id: string;
  tr: string;
  kind: AbilityKind;
  target: AbilityTarget;
  range: number;
  aoe: number;
  mp: number;
  power: number;
  needsLoS: boolean;
  status?: StatusApply;
  desc: string;
}

const A = (a: Ability): Ability => a;

export const UNIVERSAL: Ability[] = [
  A({ id: "strike", tr: "Vuruş", kind: "attack", target: "enemy", range: 1, aoe: 0, mp: 0, power: 6, needsLoS: false, desc: "Bitişik düşmana yakın dövüş vuruşu." }),
  A({ id: "guard", tr: "Savunma", kind: "buff", target: "self", range: 0, aoe: 0, mp: 0, power: 0, needsLoS: false, status: { id: "shield", label: "Kalkan", turns: 2 }, desc: "Gelen hasarı azaltan bir kalkan kurar." }),
];

export const ABILITIES: Record<string, Ability> = {
  "Shield Wall": A({ id: "shield_wall", tr: "Kalkan Duvarı", kind: "buff", target: "self", range: 0, aoe: 0, mp: 2, power: 0, needsLoS: false, status: { id: "shield", label: "Kalkan", turns: 3 }, desc: "Sağlam bir kalkan; birkaç tur hasarı yarıya indirir." }),
  "Arcane Bolt": A({ id: "arcane_bolt", tr: "Arkan Oku", kind: "spell", target: "enemy", range: 4, aoe: 0, mp: 3, power: 10, needsLoS: true, desc: "Uzaktan tek hedefe büyü hasarı." }),
  "Backstab": A({ id: "backstab", tr: "Sırttan Bıçak", kind: "attack", target: "enemy", range: 1, aoe: 0, mp: 1, power: 12, needsLoS: false, status: { id: "bleed", label: "Kanama", turns: 3 }, desc: "Ağır yakın vuruş; kanama bırakır." }),
  "Aimed Shot": A({ id: "aimed_shot", tr: "Nişanlı Atış", kind: "attack", target: "enemy", range: 5, aoe: 0, mp: 2, power: 9, needsLoS: true, desc: "Uzun menzilli isabetli ok." }),
  "Mend Wounds": A({ id: "mend_wounds", tr: "Yara Sar", kind: "heal", target: "ally", range: 3, aoe: 0, mp: 3, power: 14, needsLoS: false, desc: "Bir müttefiğin canını doldurur." }),
  "Hex": A({ id: "hex", tr: "Lanet", kind: "spell", target: "enemy", range: 4, aoe: 0, mp: 3, power: 4, needsLoS: true, status: { id: "poison", label: "Zehir", turns: 3 }, desc: "Zehirli lanet; her tur eritir." }),
  "Shadow Strike": A({ id: "shadow_strike", tr: "Gölge Darbe", kind: "attack", target: "enemy", range: 2, aoe: 0, mp: 2, power: 14, needsLoS: true, desc: "Gölgeden sıçrayan ölümcül darbe." }),
  "Summon Beast": A({ id: "summon_beast", tr: "Canavar Çağır", kind: "spell", target: "enemy", range: 3, aoe: 1, mp: 4, power: 7, needsLoS: false, desc: "Çağrılan canavar bir alanı savurur." }),
  "Raise Dead": A({ id: "raise_dead", tr: "Ölü Dirilt", kind: "spell", target: "enemy", range: 3, aoe: 1, mp: 4, power: 6, needsLoS: true, status: { id: "poison", label: "Çürüme", turns: 2 }, desc: "Çürüyen ölüler bir alanı sarar." }),
  "Firebolt": A({ id: "firebolt", tr: "Ateş Oku", kind: "spell", target: "enemy", range: 4, aoe: 0, mp: 3, power: 9, needsLoS: true, status: { id: "burn", label: "Alev", turns: 2 }, desc: "Yakan bir alev oku." }),
  "Cleave": A({ id: "cleave", tr: "Yarma", kind: "attack", target: "enemy", range: 1, aoe: 1, mp: 2, power: 8, needsLoS: false, desc: "Bitişik tüm düşmanları biçer." }),
};

export function abilitiesFor(names: string[] | null | undefined): Ability[] {
  const out = [...UNIVERSAL];
  const seen = new Set(out.map((a) => a.id));
  for (const n of names || []) {
    if (n.startsWith("Tabiat:") || n.startsWith("Şekil:")) continue;
    const a = ABILITIES[n];
    if (a && !seen.has(a.id)) {
      out.push(a);
      seen.add(a.id);
    }
  }
  return out;
}

export function abilityById(id: string, names: string[] | null | undefined): Ability | undefined {
  return abilitiesFor(names).find((a) => a.id === id);
}

export function hasLoS(arena: BattleArena, fromKey: string, toKey: string): boolean {
  const line = axialLine(parseKey(fromKey), parseKey(toKey));
  for (let i = 1; i < line.length - 1; i++) {
    if (terrainBlocks(arena.terrain[key(line[i].q, line[i].r)])) return false;
  }
  return true;
}

export function aoeHexes(centerKey: string, radius: number): string[] {
  if (radius <= 0) return [centerKey];
  return axialRange(parseKey(centerKey), radius).map((a) => key(a.q, a.r));
}

export function inRange(fromKey: string, toKey: string, range: number): boolean {
  return axialDistance(parseKey(fromKey), parseKey(toKey)) <= range;
}

export function rollDamage(power: number, salt: number): number {
  const h = (Math.imul((salt | 0) ^ 0x9e3779b9, 2654435761) >>> 0) / 4294967296;
  const variance = Math.round((h - 0.5) * power * 0.4);
  return Math.max(1, power + variance);
}

export function enemyAttackPower(hpMax: number): number {
  return 4 + Math.floor(hpMax / 7);
}

export function hasShield(status: { id: string; label: string; turns?: number }[] | null | undefined): boolean {
  return !!status?.some((s) => (s.id + s.label).toLowerCase().includes("kalkan") || (s.id + s.label).toLowerCase().includes("shield"));
}

export function isStunned(status: { id: string; label: string; turns?: number }[] | null | undefined): boolean {
  return !!status?.some((s) => (s.id + s.label).toLowerCase().includes("stun") || (s.id + s.label).toLowerCase().includes("sersem"));
}

export function tickEnemyStatus(status: { id: string; label: string; turns?: number }[] | null | undefined): { status: { id: string; label: string; turns?: number }[]; dmg: number } {
  if (!status?.length) return { status: [], dmg: 0 };
  let dmg = 0;
  const kept: { id: string; label: string; turns?: number }[] = [];
  for (const s of status) {
    const id = (s.id + s.label).toLowerCase();
    if (/(poison|zehir|çürü|curu)/.test(id)) dmg += 3;
    else if (/(burn|yan|alev|fire)/.test(id)) dmg += 4;
    else if (/(bleed|kanama)/.test(id)) dmg += 2;
    const turns = (s.turns ?? 3) - 1;
    if (turns > 0) kept.push({ ...s, turns });
  }
  return { status: kept, dmg };
}
