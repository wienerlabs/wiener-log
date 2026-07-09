"use client";

import { useEffect, useState } from "react";

const SHAPES: Record<number, string> = {
  4: "50,10 92,84 8,84",
  6: "18,18 82,18 82,82 18,82",
  8: "50,6 94,50 50,94 6,50",
  10: "50,5 90,40 72,93 28,93 10,40",
  12: "50,5 93,40 76,92 24,92 7,40",
};

const COLORS: Record<number, string> = {
  4: "#6f9a5f",
  6: "#5a79ad",
  8: "#4f9184",
  10: "#8a5a9a",
  12: "#b0863a",
  20: "#a06a44",
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const D20_FACES: { p: string; d: number }[] = [
  { p: "10,27 50,4 50,30", d: 40 },
  { p: "50,4 90,27 50,30", d: 46 },
  { p: "90,27 50,30 74,72", d: 8 },
  { p: "90,27 90,73 74,72", d: -8 },
  { p: "90,73 50,96 74,72", d: -30 },
  { p: "50,96 74,72 26,72", d: -40 },
  { p: "50,96 10,73 26,72", d: -30 },
  { p: "10,73 10,27 26,72", d: -8 },
  { p: "10,27 50,30 26,72", d: 8 },
  { p: "50,30 74,72 26,72", d: 20 },
];

export function Dice({
  sides,
  value,
  size = 46,
  rolling = false,
}: {
  sides: number;
  value: number;
  size?: number;
  rolling?: boolean;
}) {
  const color = COLORS[sides] || "#a06a44";
  const cls = `frp-die3d ${rolling ? "frp-roll" : ""}`;
  if (sides === 20) {
    return (
      <div style={{ width: size, height: size, perspective: 300 }} className="inline-block shrink-0">
        <svg viewBox="0 0 100 100" width={size} height={size} className={cls}>
          {D20_FACES.map((f, i) => (
            <polygon
              key={i}
              points={f.p}
              fill={shade(color, f.d)}
              stroke="#2a1c14"
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          ))}
          <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="#241812" strokeWidth={2.5} strokeLinejoin="round" />
          <text x="50" y="60" dominantBaseline="middle" textAnchor="middle" fontSize={22} fontWeight={800} fill="#fbf3df" style={{ fontFamily: "inherit" }}>
            {value}
          </text>
        </svg>
      </div>
    );
  }
  const pts = SHAPES[sides] || SHAPES[6];
  return (
    <div style={{ width: size, height: size, perspective: 300 }} className="inline-block shrink-0">
      <svg viewBox="0 0 100 100" width={size} height={size} className={cls}>
        <polygon points={pts} fill={shade(color, 10)} stroke="#2a1c14" strokeWidth={4} strokeLinejoin="round" />
        <polygon points={pts} fill="#ffffff" fillOpacity={0.08} />
        <text x="50" y="54" dominantBaseline="middle" textAnchor="middle" fontSize={sides <= 6 ? 40 : 32} fontWeight={800} fill="#fbf3df" style={{ fontFamily: "inherit" }}>
          {value}
        </text>
      </svg>
    </div>
  );
}

export function DiceRoll({
  sides,
  value,
  label,
  size = 44,
}: {
  sides: number;
  value: number;
  label?: string;
  size?: number;
}) {
  const [rolling, setRolling] = useState(true);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const iv = setInterval(() => setShown(1 + Math.floor(Math.random() * sides)), 70);
    const to = setTimeout(() => {
      clearInterval(iv);
      setShown(value);
      setRolling(false);
    }, 820);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [sides, value]);
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <Dice sides={sides} value={shown} size={size} rolling={rolling} />
      <span className="text-[9.5px] font-medium tabular-nums" style={{ color: "var(--frp-faint)" }}>
        {label ? `${label} · ` : ""}d{sides}
      </span>
    </div>
  );
}

export function ThinkingDice({ size = 22 }: { size?: number }) {
  const color = "#a06a44";
  return (
    <div style={{ width: size, height: size, perspective: 200 }} className="inline-block shrink-0">
      <svg viewBox="0 0 100 100" width={size} height={size} className="frp-die3d frp-thinking-die">
        {D20_FACES.map((f, i) => (
          <polygon key={i} points={f.p} fill={shade(color, f.d)} stroke="#2a1c14" strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="#241812" strokeWidth={3} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
