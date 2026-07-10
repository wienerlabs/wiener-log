"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateMap } from "@/lib/frp/mapgen";
import type { MapData, Tile, Poi } from "@/lib/frp/mapgen";
import { reachable, moveBudget, isNight, weatherLabel, timeLabel, biomeLabel } from "@/lib/frp/movement";
import { effectiveHouse } from "@/lib/frp/worldsim";
import type { Army, Caravan } from "@/lib/frp/worldsim";
import type { Campaign, Character } from "@/lib/frp/types";
import { Maximize2, X, CloudSun, Moon, Tent, Plus, Minus, Crosshair } from "lucide-react";
import { drawPortraitToken } from "@/components/frp/portrait-token";
import { lootSites } from "@/lib/frp/loot";
import type { LootSite } from "@/lib/frp/loot";

const SQRT3 = Math.sqrt(3);

const BIOME: Record<string, string> = {
  deep_water: "#173049",
  water: "#2f6690",
  beach: "#d8c58f",
  plains: "#8aa957",
  forest: "#3d7248",
  hills: "#9a8b4c",
  mountain: "#8b8a92",
  desert: "#d7ac63",
  swamp: "#495a3a",
  snow: "#e7eef3",
  tundra: "#bcc4b4",
  wasteland: "#7c5a45",
};

const HOUSE_COLOR: Record<string, string> = {
  kanli_tac: "#b0483f",
  kara_kuzgun: "#4a4356",
  gumus_kurt: "#7c8a99",
  altin_aslan: "#c8912e",
  yesil_yilan: "#3f7a4a",
  kizil_gul: "#b0506a",
};

const THEME_TR: Record<string, string> = {
  normal: "Ilıman dünya",
  frozen: "Donmuş dünya",
  drowned: "Boğulmuş dünya",
  wartorn: "Savaş yıkımı",
};

const POI_STYLE: Record<string, { c: string; g: string; label: string }> = {
  start: { c: "#2f81f7", g: "★", label: "Başlangıç" },
  capital: { c: "#c8912e", g: "◆", label: "Başkent" },
  market: { c: "#c8912e", g: "$", label: "Pazar" },
  forge: { c: "#8b8a92", g: "⚒", label: "Demirhane" },
  dungeon: { c: "#6a4a7a", g: "D", label: "Zindan" },
  boss: { c: "#b0483f", g: "☠", label: "Yuva" },
  sanctum: { c: "#5f7cb4", g: "✦", label: "Tapınak" },
  wild: { c: "#3f7a4a", g: "♣", label: "Yaban" },
  sin_site: { c: "#8a4a9a", g: "!", label: "Günah sitesi" },
  wonder: { c: "#c9a24a", g: "✸", label: "Harika" },
};

function tileCenter(t: Tile, size: number, ox: number, oy: number) {
  return {
    x: ox + size * SQRT3 * (t.col + 0.5 * (t.row & 1)) + size * SQRT3 * 0.5,
    y: oy + size * 1.5 * t.row + size,
  };
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    const px = cx + size * Math.cos(a);
    const py = cy + size * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function Canvas({
  map,
  characters,
  me,
  discovered,
  discoveredPois,
  reachSet,
  armies,
  caravans,
  corruption,
  control,
  loot,
  looted,
  interactive,
  onHexClick,
  onOpenFull,
}: {
  map: MapData;
  characters: Character[];
  me: string;
  discovered: Set<string>;
  discoveredPois: Set<string>;
  reachSet: Map<string, number> | null;
  armies: Army[];
  caravans: Caravan[];
  corruption: Set<string>;
  control: Record<string, string>;
  loot: LootSite[];
  looted: Set<string>;
  interactive: boolean;
  onHexClick?: (key: string) => void;
  onOpenFull?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const view = useRef({ scale: 1, ox: 0, oy: 0, size: 8 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; scale: number; cx: number; cy: number; ox: number; oy: number } | null>(null);
  const sig = useRef("");
  const [hover, setHover] = useState<{ t: Tile; poi: Poi | null; x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);

  const poiByRC = useMemo(() => {
    const m = new Map<number, Poi>();
    for (const p of map.pois) m.set(p.row * map.cols + p.col, p);
    return m;
  }, [map]);

  useEffect(() => {
    const render = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 4 || h < 4) return;
      const mapW = SQRT3 * (map.cols + 0.5);
      const mapH = 1.5 * map.rows + 0.5;
      const baseSize = interactive ? w / mapW : Math.min(w / mapW, h / mapH);
      const size = baseSize * view.current.scale;
      let ox = view.current.ox;
      let oy = view.current.oy;
      if (!interactive) {
        ox = (w - size * mapW) / 2;
        oy = (h - size * mapH) / 2;
      }
      view.current.size = size;
      view.current.ox = ox;
      view.current.oy = oy;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const controlSig = Object.entries(control).map(([a, b]) => `${a}:${b}`).join(",");
      const s = `${w}x${h}|${size.toFixed(2)}|${ox.toFixed(1)}|${oy.toFixed(1)}|${discovered.size}|${corruption.size}|${controlSig}`;
      if (sig.current !== s || !terrainRef.current) {
        sig.current = s;
        const off = document.createElement("canvas");
        off.width = w * dpr;
        off.height = h * dpr;
        const octx = off.getContext("2d")!;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.fillStyle = "#070c12";
        octx.fillRect(0, 0, w, h);
        for (const t of map.tiles) {
          const { x, y } = tileCenter(t, size, ox, oy);
          if (x < -size || x > w + size || y < -size || y > h + size) continue;
          const key = `${t.q},${t.r}`;
          const seen = discovered.has(key);
          hexPath(octx, x, y, size + 0.6);
          if (!seen) {
            octx.fillStyle = "#0d141d";
            octx.fill();
            continue;
          }
          octx.fillStyle = t.river ? "#2f6690" : BIOME[t.biome];
          octx.fill();
          if (t.region && t.biome !== "deep_water" && t.biome !== "water") {
            const rh = effectiveHouse(control, t.region);
            octx.fillStyle = HOUSE_COLOR[rh || ""] || "#888";
            octx.globalAlpha = 0.14;
            octx.fill();
            octx.globalAlpha = 1;
          }
          if (corruption.has(key)) {
            octx.fillStyle = "#2a0f33";
            octx.globalAlpha = 0.5;
            octx.fill();
            octx.globalAlpha = 1;
          }
        }
        terrainRef.current = off;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(terrainRef.current, 0, 0, w, h);

      if (reachSet) {
        for (const [k] of reachSet) {
          const [q, r] = k.split(",").map(Number);
          const t = map.tiles.find((tt) => tt.q === q && tt.r === r);
          if (!t) continue;
          const { x, y } = tileCenter(t, size, ox, oy);
          hexPath(ctx, x, y, size * 0.92);
          ctx.strokeStyle = "rgba(120,200,255,0.75)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      if (hover) {
        const { x, y } = tileCenter(hover.t, size, ox, oy);
        hexPath(ctx, x, y, size);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      for (const p of map.pois) {
        if (p.hidden && !discoveredPois.has(p.id)) continue;
        if (!discovered.has(`${p.q},${p.r}`)) continue;
        const t = map.tiles[p.row * map.cols + p.col];
        const { x, y } = tileCenter(t, size, ox, oy);
        const st = POI_STYLE[p.kind];
        if (!st) continue;
        const rad = Math.max(3.5, size * 0.62);
        const fill = p.kind === "capital" && p.house ? HOUSE_COLOR[p.house] || st.c : st.c;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
        if (size >= 6) {
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(rad * 1.05)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(st.g, x, y + 0.5);
        }
        if (interactive && size >= 9 && (p.kind === "capital" || p.kind === "start" || p.kind === "boss" || p.kind === "sanctum")) {
          ctx.font = `600 ${Math.max(9, size * 0.85)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.strokeStyle = "rgba(0,0,0,0.65)";
          ctx.lineWidth = 2.5;
          ctx.strokeText(p.name, x, y + rad + 1);
          ctx.fillStyle = "rgba(255,255,255,0.94)";
          ctx.fillText(p.name, x, y + rad + 1);
        }
      }

      for (const cv of caravans) {
        if (!discovered.has(`${cv.q},${cv.r}`)) continue;
        const t = map.tiles.find((x) => x.q === cv.q && x.r === cv.r);
        if (!t) continue;
        const { x, y } = tileCenter(t, size, ox, oy);
        const rad = Math.max(2.5, size * 0.3);
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = "#c8a24a";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
      }
      for (const a of armies) {
        if (!discovered.has(`${a.q},${a.r}`)) continue;
        const t = map.tiles.find((x) => x.q === a.q && x.r === a.r);
        if (!t) continue;
        const { x, y } = tileCenter(t, size, ox, oy);
        const rad = Math.max(3, size * 0.5);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = HOUSE_COLOR[effectiveHouse(control, a.house) || a.house] || "#999";
        ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.strokeRect(-rad, -rad, rad * 2, rad * 2);
        ctx.restore();
        if (size >= 6) {
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(rad * 1.05)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(a.siege > 0 ? "⚔" : "⚑", x, y + 0.5);
        }
      }

      for (const l of loot) {
        const k = `${l.q},${l.r}`;
        if (looted.has(k) || !discovered.has(k)) continue;
        const t = map.tiles.find((x) => x.q === l.q && x.r === l.r);
        if (!t) continue;
        const { x, y } = tileCenter(t, size, ox, oy);
        const w = Math.max(4, size * 0.62), h = w * 0.78, top = y - h * 0.5;
        if (l.tier >= 3) {
          ctx.beginPath();
          ctx.arc(x, y, w * 0.95, 0, Math.PI * 2);
          ctx.fillStyle = l.tier >= 4 ? "rgba(224,90,120,0.28)" : "rgba(224,182,77,0.24)";
          ctx.fill();
        }
        ctx.fillStyle = "#5a3a1e";
        ctx.fillRect(x - w / 2, top + h * 0.32, w, h * 0.68);
        ctx.fillStyle = "#7a4e26";
        ctx.fillRect(x - w / 2, top, w, h * 0.4);
        ctx.fillStyle = "#e0b64d";
        ctx.fillRect(x - w / 2, top + h * 0.3, w, Math.max(1.5, h * 0.14));
        ctx.fillRect(x - w * 0.12, top + h * 0.24, w * 0.24, h * 0.34);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeRect(x - w / 2, top, w, h);
      }

      const seenCount = new Map<string, number>();
      for (const c of characters) {
        if (!c.alive) continue;
        const [q, r] = (c.location || "").split(",").map(Number);
        const tl = map.tiles.find((t) => t.q === q && t.r === r);
        if (!tl) continue;
        const kk = `${tl.col},${tl.row}`;
        const idx = seenCount.get(kk) || 0;
        seenCount.set(kk, idx + 1);
        const { x, y } = tileCenter(tl, size, ox, oy);
        const rad = Math.max(6, size * 0.62);
        const px = x + (idx % 3) * rad * 0.8 - rad * 0.8;
        const py = y - Math.floor(idx / 3) * rad * 0.8;
        drawPortraitToken(ctx, c.portrait_seed || c.handle, c.race, px, py, rad * 2, c.handle === me ? "#e0b64d" : "#2f81f7");
        if (rad > 9) {
          const label = c.name || c.handle;
          ctx.font = `600 ${Math.round(rad * 0.62)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(10,16,22,0.72)";
          ctx.fillRect(px - tw / 2 - 3, py + rad + 2, tw + 6, rad * 0.78);
          ctx.fillStyle = c.handle === me ? "#e6c56a" : "#dbe6f0";
          ctx.fillText(label, px, py + rad + 3);
        }
      }
    };
    render();
    const ro = new ResizeObserver(() => {
      terrainRef.current = null;
      render();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [map, characters, me, discovered, discoveredPois, reachSet, armies, caravans, corruption, control, loot, looted, hover, interactive, poiByRC, tick]);

  const pick = (clientX: number, clientY: number): { t: Tile; poi: Poi | null } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { size, ox, oy } = view.current;
    let best: Tile | null = null;
    let bd = Infinity;
    for (const t of map.tiles) {
      const { x, y } = tileCenter(t, size, ox, oy);
      const d = (x - mx) * (x - mx) + (y - my) * (y - my);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best || bd > size * size * 1.3) return null;
    return { t: best, poi: poiByRC.get(best.row * map.cols + best.col) || null };
  };

  const zoomBy = (f: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const mx = wrap.clientWidth / 2, my = wrap.clientHeight / 2;
    const s0 = view.current.scale, s1 = Math.max(0.6, Math.min(8, s0 * f)), k = s1 / s0;
    view.current.ox = mx - (mx - view.current.ox) * k;
    view.current.oy = my - (my - view.current.oy) * k;
    view.current.scale = s1;
    terrainRef.current = null;
    setTick((n) => n + 1);
  };
  const recenter = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const mine = characters.find((c) => c.handle === me && c.alive) || characters.find((c) => c.alive);
    if (!mine) return;
    const [q, r] = (mine.location || "").split(",").map(Number);
    const tl = map.tiles.find((t) => t.q === q && t.r === r);
    if (!tl) return;
    view.current.scale = Math.max(view.current.scale, 2.6);
    const size = (wrap.clientWidth / (SQRT3 * (map.cols + 0.5))) * view.current.scale;
    const { x, y } = tileCenter(tl, size, 0, 0);
    view.current.ox = wrap.clientWidth / 2 - x;
    view.current.oy = wrap.clientHeight / 2 - y;
    terrainRef.current = null;
    setTick((n) => n + 1);
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: interactive ? (drag.current ? "grabbing" : "crosshair") : "pointer", touchAction: interactive ? "none" : "pan-y" }}
      onMouseDown={(e) => {
        if (!interactive) return;
        drag.current = { x: e.clientX, y: e.clientY, ox: view.current.ox, oy: view.current.oy, moved: false };
      }}
      onMouseMove={(e) => {
        if (interactive && drag.current) {
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
          view.current.ox = drag.current.ox + dx;
          view.current.oy = drag.current.oy + dy;
          terrainRef.current = null;
          setTick((n) => n + 1);
          return;
        }
        if (interactive) {
          const p = pick(e.clientX, e.clientY);
          const rect = wrapRef.current!.getBoundingClientRect();
          setHover(p ? { t: p.t, poi: p.poi, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
        }
      }}
      onMouseUp={() => {
        drag.current = null;
      }}
      onMouseLeave={() => {
        drag.current = null;
        setHover(null);
      }}
      onClick={(e) => {
        if (!interactive) {
          onOpenFull?.();
          return;
        }
        if (drag.current?.moved) return;
        const p = pick(e.clientX, e.clientY);
        if (p) onHexClick?.(`${p.t.q},${p.t.r}`);
      }}
      onWheel={(e) => {
        if (!interactive) return;
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        view.current.scale = Math.max(0.6, Math.min(7, view.current.scale * f));
        terrainRef.current = null;
        setTick((n) => n + 1);
      }}
      onTouchStart={(e) => {
        if (!interactive) return;
        if (e.touches.length === 2) {
          const [a, b] = [e.touches[0], e.touches[1]];
          pinch.current = {
            dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
            scale: view.current.scale,
            cx: (a.clientX + b.clientX) / 2,
            cy: (a.clientY + b.clientY) / 2,
            ox: view.current.ox,
            oy: view.current.oy,
          };
          drag.current = null;
        } else if (e.touches.length === 1) {
          const t = e.touches[0];
          drag.current = { x: t.clientX, y: t.clientY, ox: view.current.ox, oy: view.current.oy, moved: false };
          pinch.current = null;
          setHover(null);
        }
      }}
      onTouchMove={(e) => {
        if (!interactive) return;
        if (pinch.current && e.touches.length === 2) {
          const [a, b] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
          const rect = wrapRef.current!.getBoundingClientRect();
          const mx = pinch.current.cx - rect.left;
          const my = pinch.current.cy - rect.top;
          const newScale = Math.max(0.6, Math.min(7, pinch.current.scale * (dist / pinch.current.dist)));
          const k = newScale / pinch.current.scale;
          view.current.scale = newScale;
          view.current.ox = mx - (mx - pinch.current.ox) * k;
          view.current.oy = my - (my - pinch.current.oy) * k;
          terrainRef.current = null;
          setTick((n) => n + 1);
          return;
        }
        if (drag.current && e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - drag.current.x;
          const dy = t.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
          view.current.ox = drag.current.ox + dx;
          view.current.oy = drag.current.oy + dy;
          terrainRef.current = null;
          setTick((n) => n + 1);
        }
      }}
      onTouchEnd={(e) => {
        if (!interactive) return;
        if (drag.current && !drag.current.moved && !pinch.current && e.changedTouches.length === 1) {
          const t = e.changedTouches[0];
          const p = pick(t.clientX, t.clientY);
          if (p) onHexClick?.(`${p.t.q},${p.t.r}`);
        }
        drag.current = null;
        pinch.current = null;
      }}
    >
      <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />
      {interactive && hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-[8px] px-2 py-1 text-[11px]"
          style={{ left: hover.x + 12, top: hover.y + 12, background: "rgba(12,18,26,0.92)", color: "#e7eef3", border: "1px solid rgba(255,255,255,0.12)", maxWidth: 220 }}
        >
          {hover.poi && (!hover.poi.hidden || discoveredPois.has(hover.poi.id)) && discovered.has(`${hover.poi.q},${hover.poi.r}`) ? (
            <div className="font-semibold">
              {POI_STYLE[hover.poi.kind]?.label} · {hover.poi.name}
            </div>
          ) : null}
          <div style={{ color: "#9fb0c0" }}>
            {discovered.has(`${hover.t.q},${hover.t.r}`) ? `${biomeLabel(hover.t.biome)} · tehlike ${hover.t.danger}${reachSet?.has(`${hover.t.q},${hover.t.r}`) ? " · gidilebilir" : ""}${loot.some((l) => l.q === hover.t.q && l.r === hover.t.r) && !looted.has(`${hover.t.q},${hover.t.r}`) ? " · 📦 zula" : ""}` : "keşfedilmemiş"}
          </div>
        </div>
      ) : null}
      {interactive ? (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
          <button type="button" aria-label="Yakınlaştır" onClick={() => zoomBy(1.35)} className="flex size-9 items-center justify-center rounded-[9px] text-white" style={{ background: "rgba(18,26,36,0.9)", border: "1px solid rgba(255,255,255,0.16)" }}>
            <Plus className="size-[18px]" strokeWidth={2.4} />
          </button>
          <button type="button" aria-label="Uzaklaştır" onClick={() => zoomBy(1 / 1.35)} className="flex size-9 items-center justify-center rounded-[9px] text-white" style={{ background: "rgba(18,26,36,0.9)", border: "1px solid rgba(255,255,255,0.16)" }}>
            <Minus className="size-[18px]" strokeWidth={2.4} />
          </button>
          <button type="button" aria-label="Karakterime odaklan" onClick={recenter} className="flex size-9 items-center justify-center rounded-[9px]" style={{ background: "rgba(224,182,77,0.9)", border: "1px solid rgba(255,255,255,0.2)", color: "#1b2430" }}>
            <Crosshair className="size-[18px]" strokeWidth={2.4} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Overworld({
  campaign,
  characters,
  me,
  onHexTravel,
  onCamp,
  canTravel,
  busy,
}: {
  campaign: Campaign;
  characters: Character[];
  me: string;
  onHexTravel: (key: string) => void;
  onCamp: () => void;
  canTravel: boolean;
  busy: boolean;
}) {
  const map = useMemo(() => generateMap(campaign.map_seed || "wiener"), [campaign.map_seed]);
  const [full, setFull] = useState(false);
  const discovered = useMemo(() => new Set(campaign.discovered || []), [campaign.discovered]);
  const discoveredPois = useMemo(() => new Set(campaign.map_state?.discovered_pois || []), [campaign.map_state]);
  const armies = useMemo(() => campaign.map_state?.armies || [], [campaign.map_state]);
  const caravans = useMemo(() => campaign.map_state?.caravans || [], [campaign.map_state]);
  const corruption = useMemo(() => new Set(campaign.map_state?.corruption || []), [campaign.map_state]);
  const control = useMemo(() => campaign.map_state?.control || {}, [campaign.map_state]);
  const loot = useMemo(() => lootSites(map), [map]);
  const looted = useMemo(() => new Set(campaign.map_state?.looted || []), [campaign.map_state]);
  const myChar = characters.find((c) => c.handle === me);
  const isMyTurn = campaign.status === "active" && campaign.current_turn === me && !!myChar?.alive && !campaign.encounter?.active;
  const reachSet = useMemo(() => {
    if (!isMyTurn || !myChar) return null;
    const mount = (myChar.mount as "horse" | "boat" | null) || null;
    return reachable(map, myChar.location, moveBudget(myChar.class, myChar.class2, mount), mount);
  }, [isMyTurn, myChar, map]);

  const time = campaign.map_state?.time ?? 6;
  const weather = campaign.map_state?.weather ?? "clear";
  const night = isNight(time);

  const click = (key: string) => {
    if (busy || !isMyTurn) return;
    if (reachSet?.has(key)) {
      setFull(false);
      onHexTravel(key);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
        <span className="inline-flex items-center gap-1">
          {night ? <Moon className="size-[11px]" strokeWidth={2} /> : <CloudSun className="size-[11px]" strokeWidth={2} />}
          {timeLabel(time)} · {weatherLabel(weather)}
        </span>
        <span className="inline-flex items-center gap-1">
          {canTravel ? (
            <button type="button" onClick={onCamp} disabled={busy} className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 disabled:opacity-50" style={{ color: "var(--frp-ink-soft)", background: "var(--frp-track)" }}>
              <Tent className="size-[11px]" strokeWidth={2.2} /> kamp
            </button>
          ) : null}
          <button type="button" onClick={() => setFull(true)} className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5" style={{ color: "var(--frp-accent-ink)", background: "var(--frp-accent-soft)" }}>
            <Maximize2 className="size-[11px]" strokeWidth={2.2} /> büyüt
          </button>
        </span>
      </div>
      <div className="rounded-[10px] overflow-hidden" style={{ height: 190, background: "#070c12", border: "1px solid var(--frp-line)" }}>
        <Canvas map={map} characters={characters} me={me} discovered={discovered} discoveredPois={discoveredPois} reachSet={reachSet} armies={armies} caravans={caravans} corruption={corruption} control={control} loot={loot} looted={looted} interactive={false} onOpenFull={() => setFull(true)} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "var(--frp-muted)" }}>
        <span>{THEME_TR[map.theme] || map.theme} · tohum {map.seed}</span>
        {isMyTurn ? <span style={{ color: "var(--frp-accent-ink)" }}>büyüt → gidilecek altıgene tıkla</span> : null}
      </div>

      {full ? (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(7,11,16,0.97)" }}>
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="text-[13px] font-semibold" style={{ color: "#e7eef3" }}>
              {THEME_TR[map.theme] || map.theme} · tohum {map.seed} · {timeLabel(time)} · {weatherLabel(weather)}
            </div>
            <span className="inline-flex items-center gap-2">
              {canTravel ? (
                <button type="button" onClick={onCamp} disabled={busy} className="inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12px] disabled:opacity-50" style={{ background: "rgba(255,255,255,0.08)", color: "#e7eef3" }}>
                  <Tent className="size-[14px]" strokeWidth={2} /> kamp kur
                </button>
              ) : null}
              <button type="button" onClick={() => setFull(false)} className="inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12px]" style={{ background: "rgba(255,255,255,0.08)", color: "#e7eef3" }}>
                <X className="size-[14px]" strokeWidth={2} /> kapat
              </button>
            </span>
          </div>
          <div className="flex-1 px-4 pb-3">
            <div className="h-full w-full rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              <Canvas map={map} characters={characters} me={me} discovered={discovered} discoveredPois={discoveredPois} reachSet={reachSet} armies={armies} caravans={caravans} corruption={corruption} control={control} loot={loot} looted={looted} interactive onHexClick={click} />
            </div>
          </div>
          <div className="px-4 pb-3 text-center text-[11px]" style={{ color: "#7f95a8" }}>
            {isMyTurn ? "mavi altıgene dokun: git · sürükle: kaydır · iki parmak / tekerlek: yakınlaştır" : "sürükle: kaydır · iki parmak / tekerlek: yakınlaştır · sıra sende değil"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
