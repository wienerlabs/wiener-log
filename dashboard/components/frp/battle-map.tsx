"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { axialToPixel, offsetToAxial, key as hexKey } from "@/lib/frp/hex";
import { arenaReachable, battleMoveBudget, TERRAIN_TR } from "@/lib/frp/battle";
import type { Campaign, Character, BattleArena, ArenaTerrain } from "@/lib/frp/types";
import { Swords } from "lucide-react";

const SQRT3 = Math.sqrt(3);

const TERRAIN_FILL: Record<ArenaTerrain, string> = {
  rock: "#3b4250",
  tree: "#1f3a2a",
  water: "#16394d",
  high: "#4a4232",
  ember: "#4a1f1a",
};

const TERRAIN_MARK: Record<ArenaTerrain, string> = {
  rock: "#8994a5",
  tree: "#4f9e63",
  water: "#4aa6cf",
  high: "#c7a24d",
  ember: "#e06a4a",
};

type Cell = { key: string; x: number; y: number };

function BattleCanvas({
  arena,
  characters,
  enemies,
  reachSet,
  meKey,
  onCellClick,
}: {
  arena: BattleArena;
  characters: Character[];
  enemies: { name: string; hp: number; hp_max: number; telegraph?: string }[];
  reachSet: Map<string, number> | null;
  meKey: string | null;
  onCellClick: (key: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cellsRef = useRef<Cell[]>([]);
  const [w, setW] = useState(320);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(Math.max(220, Math.floor(cw)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const size = useMemo(() => {
    const s = w / (SQRT3 * (arena.w + 0.5));
    return Math.max(11, Math.min(26, s));
  }, [w, arena.w]);

  const dims = useMemo(() => {
    const cells: Cell[] = [];
    let maxX = 0;
    let maxY = 0;
    for (let row = 0; row < arena.h; row++)
      for (let col = 0; col < arena.w; col++) {
        const a = offsetToAxial(col, row);
        const p = axialToPixel(a.q, a.r, size);
        cells.push({ key: hexKey(a.q, a.r), x: p.x, y: p.y });
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    const pad = size;
    return { cells, width: maxX + pad * 1.6, height: maxY + pad * 2 };
  }, [arena.w, arena.h, size]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const cw = dims.width;
    const ch = dims.height;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const ox = size;
    const oy = size;
    const cells: Cell[] = dims.cells.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
    cellsRef.current = cells;
    const byKey = new Map(cells.map((c) => [c.key, c]));

    const hexPath = (x: number, y: number, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 180) * (60 * i - 90);
        const px = x + s * Math.cos(ang);
        const py = y + s * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    for (const c of cells) {
      const t = arena.terrain[c.key];
      hexPath(c.x, c.y, size * 0.96);
      ctx.fillStyle = t ? TERRAIN_FILL[t] : "#111a24";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#0a121b";
      ctx.stroke();
      if (t) {
        ctx.fillStyle = TERRAIN_MARK[t];
        ctx.globalAlpha = 0.9;
        if (t === "tree") {
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - size * 0.42);
          ctx.lineTo(c.x + size * 0.32, c.y + size * 0.28);
          ctx.lineTo(c.x - size * 0.32, c.y + size * 0.28);
          ctx.closePath();
          ctx.fill();
        } else if (t === "high") {
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - size * 0.4);
          ctx.lineTo(c.x + size * 0.36, c.y + size * 0.3);
          ctx.lineTo(c.x - size * 0.36, c.y + size * 0.3);
          ctx.closePath();
          ctx.stroke();
          ctx.strokeStyle = TERRAIN_MARK[t];
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(c.x, c.y, size * 0.26, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    if (reachSet) {
      for (const k of reachSet.keys()) {
        const c = byKey.get(k);
        if (!c) continue;
        hexPath(c.x, c.y, size * 0.92);
        ctx.fillStyle = "rgba(94,171,120,0.22)";
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = "rgba(120,210,150,0.75)";
        ctx.stroke();
      }
    }

    const token = (c: Cell, fill: string, ring: string, label: string, hp: number, hpMax: number, dead: boolean) => {
      const r = size * 0.62;
      ctx.globalAlpha = dead ? 0.4 : 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y - size * 0.08, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ring;
      ctx.stroke();
      ctx.fillStyle = "#f2f6fa";
      ctx.font = `700 ${Math.round(size * 0.66)}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, c.x, c.y - size * 0.06);
      const bw = size * 1.1;
      const bx = c.x - bw / 2;
      const by = c.y + size * 0.62;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx, by, bw, size * 0.2);
      ctx.fillStyle = dead ? "#6b7280" : hp / hpMax > 0.4 ? "#57b06a" : "#d1584f";
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, hp / hpMax)), size * 0.2);
      ctx.globalAlpha = 1;
    };

    enemies.forEach((e, i) => {
      const k = arena.enemies[i];
      const c = k ? byKey.get(k) : null;
      if (!c) return;
      token(c, "#3a1620", "#b8434f", e.name.slice(0, 1).toUpperCase(), e.hp, e.hp_max, e.hp <= 0);
    });

    for (const [handle, k] of Object.entries(arena.party)) {
      const c = byKey.get(k);
      if (!c) continue;
      const ch2 = characters.find((x) => x.handle === handle);
      const dead = ch2 ? !ch2.alive : false;
      const isMe = k === meKey;
      token(
        c,
        "#123240",
        isMe ? "#e0b64d" : "#3f8fb0",
        (ch2?.name || handle).slice(0, 1).toUpperCase(),
        ch2?.hp_cur ?? 1,
        ch2?.hp_max ?? 1,
        dead,
      );
    }
  }, [arena, characters, enemies, reachSet, meKey, size, dims]);

  const handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!reachSet) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    let best: Cell | null = null;
    let bestD = Infinity;
    for (const c of cellsRef.current) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best && bestD <= (size * 0.95) ** 2 && reachSet.has(best.key)) onCellClick(best.key);
  };

  return (
    <div ref={wrapRef} className="w-full overflow-hidden rounded-[10px]" style={{ background: "#070c12", border: "1px solid var(--frp-line)" }}>
      <canvas ref={ref} onClick={handleClick} style={{ display: "block", cursor: reachSet ? "pointer" : "default" }} />
    </div>
  );
}

export function BattleMap({
  campaign,
  characters,
  me,
  onBattleMove,
  busy,
}: {
  campaign: Campaign;
  characters: Character[];
  me: string;
  onBattleMove: (key: string) => void;
  busy: boolean;
}) {
  const arena = campaign.encounter?.active ? campaign.encounter.arena : undefined;
  const enemies = campaign.encounter?.enemies || [];
  const myChar = characters.find((c) => c.handle === me);
  const isMyTurn = campaign.status === "active" && campaign.current_turn === me && !!myChar?.alive;
  const meKey = arena && myChar ? arena.party[me] || null : null;
  const alreadyMoved = !!arena && (arena.moved || []).includes(me);
  const reachSet = useMemo(() => {
    if (!arena || !isMyTurn || !myChar || !meKey || busy || alreadyMoved) return null;
    return arenaReachable(arena, meKey, battleMoveBudget(myChar.class, myChar.class2));
  }, [arena, isMyTurn, myChar, meKey, busy, alreadyMoved]);

  if (!arena) return null;

  const terrainsHere = new Set(Object.values(arena.terrain));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
        <span className="inline-flex items-center gap-1">
          <Swords className="size-[11px]" strokeWidth={2} /> Savaş alanı
        </span>
        <span style={{ color: isMyTurn && !alreadyMoved ? "var(--frp-accent-ink)" : "var(--frp-muted)" }}>
          {!isMyTurn ? "sıra sende değil" : alreadyMoved ? "mevzilendin: eylemini yaz" : reachSet ? "yeşil altıgene tıkla: mevzilen" : "..."}
        </span>
      </div>
      <BattleCanvas arena={arena} characters={characters} enemies={enemies} reachSet={reachSet} meKey={meKey} onCellClick={onBattleMove} />
      {terrainsHere.size ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px]" style={{ color: "var(--frp-muted)" }}>
          {[...terrainsHere].map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block size-[8px] rounded-[2px]" style={{ background: TERRAIN_MARK[t] }} />
              {TERRAIN_TR[t]}
              {t === "high" ? " (avantaj)" : t === "tree" || t === "rock" ? " (siper)" : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
