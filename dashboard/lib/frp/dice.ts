function randInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

export function rollDie(sides: number): number {
  return randInt(sides) + 1;
}

export interface DicePool {
  d20: number[];
  d12: number;
  d8: number;
  d6: number[];
  d100: number;
}

export function rollPool(): DicePool {
  return {
    d20: [rollDie(20), rollDie(20), rollDie(20), rollDie(20)],
    d12: rollDie(12),
    d8: rollDie(8),
    d6: [rollDie(6), rollDie(6), rollDie(6)],
    d100: rollDie(100),
  };
}

export function poolToPrompt(p: DicePool): string {
  return `d20: ${p.d20.join(", ")} | d12: ${p.d12} | d8: ${p.d8} | d6: ${p.d6.join(", ")} | d100: ${p.d100}`;
}
