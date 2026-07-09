function randInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

export function rollDie(sides: number): number {
  return randInt(sides) + 1;
}

function rolls(sides: number, n: number): number[] {
  return Array.from({ length: n }, () => rollDie(sides));
}

export interface DicePool {
  d4: number[];
  d6: number[];
  d8: number[];
  d10: number[];
  d12: number[];
  d20: number[];
}

export function rollPool(): DicePool {
  return {
    d4: rolls(4, 2),
    d6: rolls(6, 3),
    d8: rolls(8, 2),
    d10: rolls(10, 2),
    d12: rolls(12, 1),
    d20: rolls(20, 4),
  };
}

export function poolToPrompt(p: DicePool): string {
  return [
    `d4: ${p.d4.join(", ")}`,
    `d6: ${p.d6.join(", ")}`,
    `d8: ${p.d8.join(", ")}`,
    `d10: ${p.d10.join(", ")}`,
    `d12: ${p.d12.join(", ")}`,
    `d20: ${p.d20.join(", ")}`,
  ].join(" | ");
}
