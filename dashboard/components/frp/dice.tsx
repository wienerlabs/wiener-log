"use client";

import { useEffect, useState } from "react";

const SHAPES: Record<number, string> = {
  4: "50,10 92,84 8,84",
  6: "18,18 82,18 82,82 18,82",
  8: "50,6 94,50 50,94 6,50",
  10: "50,5 90,40 72,93 28,93 10,40",
  12: "50,5 93,40 76,92 24,92 7,40",
  20: "50,4 88,27 88,73 50,96 12,73 12,27",
};

const COLORS: Record<number, string> = {
  4: "#6f9a5f",
  6: "#5a79ad",
  8: "#4f9184",
  10: "#8a5a9a",
  12: "#b0863a",
  20: "#9c6644",
};

export function Dice({
  sides,
  value,
  size = 42,
  rolling = false,
}: {
  sides: number;
  value: number;
  size?: number;
  rolling?: boolean;
}) {
  const color = COLORS[sides] || "#9c6644";
  const pts = SHAPES[sides] || SHAPES[20];
  return (
    <div
      style={{ width: size, height: size, perspective: 260 }}
      className="inline-block shrink-0"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`frp-die3d ${rolling ? "frp-roll" : ""}`}
      >
        <polygon
          points={pts}
          fill={color}
          stroke="#2e271f"
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {sides === 20 ? (
          <g stroke="#2e271f" strokeWidth={1.4} opacity={0.5} fill="none">
            <polyline points="12,27 50,40 88,27" />
            <polyline points="12,73 50,60 88,73" />
            <polyline points="50,4 50,40" />
            <polyline points="50,96 50,60" />
            <polyline points="50,40 50,60" />
          </g>
        ) : null}
        {sides === 8 || sides === 12 || sides === 10 ? (
          <g stroke="#2e271f" strokeWidth={1.3} opacity={0.45} fill="none">
            <polyline points="50,6 50,50" />
            <polyline points="50,50 90,40" />
            <polyline points="50,50 10,40" />
          </g>
        ) : null}
        <text
          x="50"
          y="54"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={sides <= 6 ? 40 : 32}
          fontWeight={800}
          fill="#f7efdd"
          style={{ fontFamily: "inherit" }}
        >
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
  size = 40,
}: {
  sides: number;
  value: number;
  label?: string;
  size?: number;
}) {
  const [rolling, setRolling] = useState(true);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const iv = setInterval(() => {
      setShown(1 + Math.floor(Math.random() * sides));
    }, 70);
    const to = setTimeout(() => {
      clearInterval(iv);
      setShown(value);
      setRolling(false);
    }, 780);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [sides, value]);
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <Dice sides={sides} value={shown} size={size} rolling={rolling} />
      <span
        className="text-[9.5px] font-medium tabular-nums"
        style={{ color: "var(--frp-faint)" }}
      >
        {label ? `${label} · ` : ""}d{sides}
      </span>
    </div>
  );
}

export function ThinkingDice({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, perspective: 160 }}
      className="inline-block shrink-0"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="frp-die3d frp-thinking-die"
      >
        <polygon
          points={SHAPES[20]}
          fill="#9c6644"
          stroke="#2e271f"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <g stroke="#2e271f" strokeWidth={2} opacity={0.5} fill="none">
          <polyline points="12,27 50,40 88,27" />
          <polyline points="50,4 50,40" />
        </g>
      </svg>
    </div>
  );
}
