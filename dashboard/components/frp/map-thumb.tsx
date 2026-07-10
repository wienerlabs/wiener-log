"use client";

import { useEffect, useMemo, useRef } from "react";
import { generateMap } from "@/lib/frp/mapgen";
import { axialToPixel } from "@/lib/frp/hex";

const SQRT3 = Math.sqrt(3);

const BIOME: Record<string, string> = {
  deep_water: "#0d2740", water: "#1a4362", beach: "#c6b070", plains: "#5f8544",
  forest: "#33623a", hills: "#7a7040", mountain: "#6b5851", desert: "#c39f57",
  swamp: "#44523e", snow: "#d9e1e7", tundra: "#98ab9d", wasteland: "#874d38",
};

const HOUSE: Record<string, string> = {
  kanli_tac: "#b0483f", kara_kuzgun: "#5a5168", gumus_kurt: "#7c8a99",
  altin_aslan: "#c8912e", yesil_yilan: "#3f7a4a", kizil_gul: "#b0506a",
};

export function MapThumb({ seed, className }: { seed: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const map = useMemo(() => generateMap(seed), [seed]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const target = 320;
    const size = target / (SQRT3 * (map.cols + 0.5));
    let maxX = 0, maxY = 0;
    for (const t of map.tiles) {
      const p = axialToPixel(t.q, t.r, size);
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = size * 1.2;
    const W = maxX + pad * 2, H = maxY + pad * 2;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.aspectRatio = `${W} / ${H}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#081726";
    ctx.fillRect(0, 0, W, H);

    const hex = (x: number, y: number, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 90);
        const px = x + s * Math.cos(a), py = y + s * Math.sin(a);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };

    for (const t of map.tiles) {
      const p = axialToPixel(t.q, t.r, size);
      const x = p.x + pad, y = p.y + pad;
      hex(x, y, size * 0.96);
      ctx.fillStyle = BIOME[t.biome] || "#334";
      ctx.fill();
      const land = t.biome !== "water" && t.biome !== "deep_water";
      if (land && t.region && HOUSE[t.region]) {
        ctx.fillStyle = HOUSE[t.region];
        ctx.globalAlpha = 0.24;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (t.river) {
        ctx.fillStyle = "#2f6f9a";
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    for (const poi of map.pois) {
      if (poi.kind !== "capital") continue;
      const p = axialToPixel(poi.q, poi.r, size);
      ctx.beginPath();
      ctx.arc(p.x + pad, p.y + pad, size * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = HOUSE[poi.house || ""] || "#e8e0d0";
      ctx.fill();
      ctx.lineWidth = size * 0.4;
      ctx.strokeStyle = "#081726";
      ctx.stroke();
    }

    const sp = axialToPixel(map.start.q, map.start.r, size);
    ctx.beginPath();
    ctx.arc(sp.x + pad, sp.y + pad, size * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe08a";
    ctx.fill();
    ctx.lineWidth = size * 0.35;
    ctx.strokeStyle = "#4a2f10";
    ctx.stroke();
  }, [map]);

  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", imageRendering: "pixelated" }} />;
}
