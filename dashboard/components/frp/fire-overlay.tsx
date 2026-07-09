"use client";

import { useEffect, useState } from "react";

interface Ember {
  id: number;
  left: number;
  size: number;
  dur: number;
  delay: number;
}

export function FireOverlay({ trigger }: { trigger: number }) {
  const [embers, setEmbers] = useState<Ember[]>([]);

  useEffect(() => {
    if (trigger <= 0) return;
    const batch: Ember[] = Array.from({ length: 120 }, (_, i) => ({
      id: trigger * 1000 + i,
      left: Math.random() * 100,
      size: 16 + Math.random() * 26,
      dur: 2.4 + Math.random() * 2.2,
      delay: Math.random() * 1.4,
    }));
    setEmbers(batch);
    const to = setTimeout(() => setEmbers([]), 6000);
    return () => clearTimeout(to);
  }, [trigger]);

  if (!embers.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {embers.map((e) => (
        <span
          key={e.id}
          className="frp-fire"
          style={{
            left: `${e.left}%`,
            fontSize: e.size,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
          }}
        >
          🔥
        </span>
      ))}
    </div>
  );
}
