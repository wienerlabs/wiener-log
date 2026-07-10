"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateMap } from "@/lib/frp/mapgen";
import type { MapData, Tile, Poi } from "@/lib/frp/mapgen";
import type { Character } from "@/lib/frp/types";
import { Maximize2, X } from "lucide-react";

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
};

function tileCenter(t: Tile, size: number, ox: number, oy: number) {
  const x = ox + size * SQRT3 * (t.col + 0.5 * (t.row & 1)) + size * SQRT3 * 0.5;
  const y = oy + size * 1.5 * t.row + size;
  return { x, y };
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

function parseLoc(loc: string | null | undefined): { q: number; r: number } | null {
  if (!loc || !/^-?\d+,-?\d+$/.test(loc)) return null;
  const [q, r] = loc.split(",").map(Number);
  return { q, r };
}

function Canvas({
  map,
  characters,
  interactive,
}: {
  map: MapData;
  characters: Character[];
  interactive: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const view = useRef({ scale: 1, ox: 0, oy: 0, size: 8 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const sig = useRef("");
  const [hover, setHover] = useState<{ t: Tile; poi: Poi | null; x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);

  const poiByRC = useMemo(() => {
    const m = new Map<number, Poi>();
    for (const p of map.pois) m.set(p.row * map.cols + p.col, p);
    return m;
  }, [map]);
  const startTile = useMemo(() => map.tiles.find((t) => t.q === map.start.q && t.r === map.start.r) || map.tiles[0], [map]);

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

      const s = `${w}x${h}|${size.toFixed(2)}|${ox.toFixed(1)}|${oy.toFixed(1)}`;
      if (sig.current !== s || !terrainRef.current) {
        sig.current = s;
        const off = document.createElement("canvas");
        off.width = w * dpr;
        off.height = h * dpr;
        const octx = off.getContext("2d")!;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.fillStyle = "#0b1520";
        octx.fillRect(0, 0, w, h);
        for (const t of map.tiles) {
          const { x, y } = tileCenter(t, size, ox, oy);
          if (x < -size || x > w + size || y < -size || y > h + size) continue;
          hexPath(octx, x, y, size + 0.6);
          octx.fillStyle = t.river ? "#2f6690" : BIOME[t.biome];
          octx.fill();
          if (t.region && t.biome !== "deep_water" && t.biome !== "water") {
            octx.fillStyle = HOUSE_COLOR[t.region] || "#888";
            octx.globalAlpha = 0.14;
            octx.fill();
            octx.globalAlpha = 1;
          }
        }
        terrainRef.current = off;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(terrainRef.current, 0, 0, w, h);

      if (hover) {
        const { x, y } = tileCenter(hover.t, size, ox, oy);
        hexPath(ctx, x, y, size);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      for (const p of map.pois) {
        if (p.hidden) continue;
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
        if (interactive && size >= 9 && (p.kind === "capital" || p.kind === "start")) {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = `600 ${Math.max(9, size * 0.9)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 2.5;
          ctx.strokeText(p.name, x, y + rad + 1);
          ctx.fillText(p.name, x, y + rad + 1);
        }
      }

      const seen = new Map<string, number>();
      for (const c of characters) {
        if (!c.alive) continue;
        const loc = parseLoc(c.location) || map.start;
        const tl = map.tiles.find((t) => t.q === loc.q && t.r === loc.r) || startTile;
        const kk = `${tl.col},${tl.row}`;
        const idx = seen.get(kk) || 0;
        seen.set(kk, idx + 1);
        const { x, y } = tileCenter(tl, size, ox, oy);
        const rad = Math.max(4, size * 0.5);
        const px = x + (idx % 3) * rad * 0.9 - rad * 0.9;
        const py = y - Math.floor(idx / 3) * rad * 0.9;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fillStyle = "#f5eedd";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2f81f7";
        ctx.stroke();
        ctx.fillStyle = "#1b2430";
        ctx.font = `bold ${Math.round(rad * 1.1)}px ui-sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((c.name || "?")[0].toUpperCase(), px, py + 0.5);
      }
    };
    render();
    const ro = new ResizeObserver(() => {
      terrainRef.current = null;
      render();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [map, characters, hover, interactive, poiByRC, startTile, tick]);

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
    if (!best || bd > (size * size) * 1.2) return null;
    return { t: best, poi: poiByRC.get(best.row * map.cols + best.col) || null };
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: interactive ? (drag.current ? "grabbing" : "grab") : "default", touchAction: "none" }}
      onMouseDown={(e) => {
        if (!interactive) return;
        drag.current = { x: e.clientX, y: e.clientY, ox: view.current.ox, oy: view.current.oy };
      }}
      onMouseMove={(e) => {
        if (interactive && drag.current) {
          view.current.ox = drag.current.ox + (e.clientX - drag.current.x);
          view.current.oy = drag.current.oy + (e.clientY - drag.current.y);
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
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => {
        drag.current = null;
        setHover(null);
      }}
      onWheel={(e) => {
        if (!interactive) return;
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        view.current.scale = Math.max(0.6, Math.min(6, view.current.scale * f));
        terrainRef.current = null;
        setTick((n) => n + 1);
      }}
    >
      <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />
      {interactive && hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-[8px] px-2 py-1 text-[11px]"
          style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12, background: "rgba(12,18,26,0.92)", color: "#e7eef3", border: "1px solid rgba(255,255,255,0.12)", maxWidth: 220 }}
        >
          {hover.poi && !hover.poi.hidden ? (
            <div className="font-semibold">
              {POI_STYLE[hover.poi.kind]?.label} · {hover.poi.name}
            </div>
          ) : null}
          <div style={{ color: "#9fb0c0" }}>
            {hover.t.biome}
            {hover.t.region ? ` · ${hover.t.region}` : ""} · tehlike {hover.t.danger}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Overworld({
  seed,
  characters,
}: {
  seed: string | null;
  characters: Character[];
}) {
  const map = useMemo(() => generateMap(seed || "wiener"), [seed]);
  const [full, setFull] = useState(false);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
        <span>Dünya haritası · {THEME_TR[map.theme] || map.theme}</span>
        <button type="button" onClick={() => setFull(true)} className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5" style={{ color: "var(--frp-accent-ink)", background: "var(--frp-accent-soft)" }}>
          <Maximize2 className="size-[11px]" strokeWidth={2.2} /> büyüt
        </button>
      </div>
      <div className="rounded-[10px] overflow-hidden" style={{ height: 190, background: "#0b1520", border: "1px solid var(--frp-line)" }}>
        <Canvas map={map} characters={characters} interactive={false} />
      </div>
      <div className="mt-1 text-[10px]" style={{ color: "var(--frp-muted)" }}>tohum: {map.seed}</div>

      {full ? (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(7,11,16,0.96)" }}>
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="text-[13px] font-semibold" style={{ color: "#e7eef3" }}>
              Dünya haritası · {THEME_TR[map.theme] || map.theme} · tohum {map.seed}
            </div>
            <button type="button" onClick={() => setFull(false)} className="inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12px]" style={{ background: "rgba(255,255,255,0.08)", color: "#e7eef3" }}>
              <X className="size-[14px]" strokeWidth={2} /> kapat
            </button>
          </div>
          <div className="flex-1 px-4 pb-4">
            <div className="h-full w-full rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              <Canvas map={map} characters={characters} interactive />
            </div>
          </div>
          <div className="px-4 pb-3 text-center text-[11px]" style={{ color: "#7f95a8" }}>
            sürükle: kaydır · tekerlek: yakınlaştır · üstüne gel: bilgi
          </div>
        </div>
      ) : null}
    </div>
  );
}
