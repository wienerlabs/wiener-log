"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { axialToPixel, offsetToAxial, key as hexKey, axialRange, parseKey } from "@/lib/frp/hex";
import { arenaReachable, battleMoveBudget, TERRAIN_TR } from "@/lib/frp/battle";
import { abilitiesFor, hasLoS, aoeHexes, inRange } from "@/lib/frp/abilities";
import type { Ability } from "@/lib/frp/abilities";
import type { Campaign, Character, BattleArena, ArenaTerrain, StatusEffect } from "@/lib/frp/types";
import { Swords, Footprints, Sparkles } from "lucide-react";

const SQRT3 = Math.sqrt(3);

const TERRAIN_FILL: Record<ArenaTerrain, string> = {
  rock: "#3b4250", tree: "#1f3a2a", water: "#16394d", high: "#4a4232", ember: "#4a1f1a",
};
const TERRAIN_MARK: Record<ArenaTerrain, string> = {
  rock: "#8994a5", tree: "#4f9e63", water: "#4aa6cf", high: "#c7a24d", ember: "#e06a4a",
};

type EnemyLite = { name: string; hp: number; hp_max: number; telegraph?: string; status?: StatusEffect[] };
type Floater = { id: number; key: string; text: string; color: string; born: number };
type Cell = { key: string; x: number; y: number };

function statusPip(s: StatusEffect): string {
  const id = (s.id + s.label).toLowerCase();
  if (/(poison|zehir|çürü|curu)/.test(id)) return "#5ec46e";
  if (/(burn|yan|alev|fire)/.test(id)) return "#e0783a";
  if (/(bleed|kanama)/.test(id)) return "#d0504a";
  if (/(shield|kalkan)/.test(id)) return "#5aa6d8";
  if (/(stun|sersem)/.test(id)) return "#e0c14a";
  return "#9aa7b4";
}

function BattleCanvas({
  arena, characters, enemies, moveSet, targetSet, rangeSet, aoeSet, meKey, floatersRef, onCellClick, onHoverCell,
}: {
  arena: BattleArena;
  characters: Character[];
  enemies: EnemyLite[];
  moveSet: Set<string> | null;
  targetSet: Set<string> | null;
  rangeSet: Set<string> | null;
  aoeSet: Set<string> | null;
  meKey: string | null;
  floatersRef: React.MutableRefObject<Floater[]>;
  onCellClick: (key: string) => void;
  onHoverCell: (key: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cellsRef = useRef<Cell[]>([]);
  const [w, setW] = useState(320);
  const props = useRef({ arena, characters, enemies, moveSet, targetSet, rangeSet, aoeSet, meKey });
  props.current = { arena, characters, enemies, moveSet, targetSet, rangeSet, aoeSet, meKey };

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

  const size = useMemo(() => Math.max(11, Math.min(26, w / (SQRT3 * (arena.w + 0.5)))), [w, arena.w]);

  const dims = useMemo(() => {
    const cells: Cell[] = [];
    let maxX = 0, maxY = 0;
    for (let row = 0; row < arena.h; row++)
      for (let col = 0; col < arena.w; col++) {
        const a = offsetToAxial(col, row);
        const p = axialToPixel(a.q, a.r, size);
        cells.push({ key: hexKey(a.q, a.r), x: p.x, y: p.y });
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    return { cells, width: maxX + size * 1.6, height: maxY + size * 2 };
  }, [arena.w, arena.h, size]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const cw = dims.width, chh = dims.height;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(chh * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${chh}px`;

    const ox = size, oy = size;
    const cells: Cell[] = dims.cells.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
    cellsRef.current = cells;
    const byKey = new Map(cells.map((c) => [c.key, c]));

    const hexPath = (x: number, y: number, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 180) * (60 * i - 90);
        const px = x + s * Math.cos(ang), py = y + s * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    let raf = 0;
    const draw = (now: number) => {
      const P = props.current;
      const pulse = 0.5 + 0.5 * Math.sin(now / 380);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, chh);

      for (const c of cells) {
        const t = P.arena.terrain[c.key];
        hexPath(c.x, c.y, size * 0.96);
        ctx.fillStyle = t ? TERRAIN_FILL[t] : "#111a24";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#0a121b";
        ctx.stroke();
        if (t) {
          ctx.fillStyle = TERRAIN_MARK[t];
          ctx.globalAlpha = t === "water" ? 0.55 + 0.35 * Math.sin(now / 300 + c.x) : 0.9;
          ctx.beginPath();
          ctx.arc(c.x, c.y, size * 0.24, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      const shade = (set: Set<string> | null, fill: string, stroke: string, breathe: boolean) => {
        if (!set) return;
        for (const k of set) {
          const c = byKey.get(k);
          if (!c) continue;
          hexPath(c.x, c.y, size * 0.92);
          ctx.fillStyle = fill;
          ctx.globalAlpha = breathe ? 0.6 + 0.4 * pulse : 1;
          ctx.fill();
          ctx.globalAlpha = 1;
          if (stroke) {
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = stroke;
            ctx.stroke();
          }
        }
      };
      shade(P.rangeSet, "rgba(90,150,220,0.10)", "", false);
      shade(P.moveSet, "rgba(94,171,120,0.20)", "rgba(120,210,150,0.8)", true);
      shade(P.aoeSet, "rgba(224,120,58,0.26)", "rgba(240,150,80,0.85)", true);
      shade(P.targetSet, "rgba(224,90,90,0.16)", "rgba(240,140,120,0.9)", true);

      const pips = (c: Cell, status: StatusEffect[] | undefined, top: number) => {
        if (!status?.length) return;
        status.slice(0, 4).forEach((s, i) => {
          ctx.fillStyle = statusPip(s);
          ctx.fillRect(c.x - size * 0.5 + i * size * 0.3, top, size * 0.24, size * 0.24);
        });
      };

      const token = (c: Cell, fill: string, ring: string, label: string, hp: number, hpMax: number, dead: boolean, status: StatusEffect[] | undefined, warn: boolean, meRing: boolean) => {
        const r = size * 0.6;
        if (meRing && !dead) {
          ctx.beginPath();
          ctx.arc(c.x, c.y - size * 0.08, r + 2 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(224,182,77,${0.35 + 0.4 * pulse})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = dead ? 0.4 : 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y - size * 0.08, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = ring;
        ctx.stroke();
        ctx.fillStyle = "#f2f6fa";
        ctx.font = `700 ${Math.round(size * 0.62)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, c.x, c.y - size * 0.06);
        const bw = size * 1.1, bx = c.x - bw / 2, by = c.y + size * 0.58;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(bx, by, bw, size * 0.2);
        ctx.fillStyle = dead ? "#6b7280" : hp / hpMax > 0.4 ? "#57b06a" : "#d1584f";
        ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, hp / hpMax)), size * 0.2);
        pips(c, status, by + size * 0.24);
        if (warn && !dead) {
          const s2 = 1 + 0.12 * pulse;
          ctx.fillStyle = "#e0c14a";
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - size * (1.05 * s2));
          ctx.lineTo(c.x + size * 0.28 * s2, c.y - size * 0.62);
          ctx.lineTo(c.x - size * 0.28 * s2, c.y - size * 0.62);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#2a2210";
          ctx.font = `700 ${Math.round(size * 0.36)}px ui-sans-serif`;
          ctx.fillText("!", c.x, c.y - size * 0.78);
        }
        ctx.globalAlpha = 1;
      };

      P.enemies.forEach((e, i) => {
        const k = P.arena.enemies[i];
        const c = k ? byKey.get(k) : null;
        if (!c) return;
        token(c, "#3a1620", "#b8434f", e.name.slice(0, 1).toUpperCase(), e.hp, e.hp_max, e.hp <= 0, e.status, !!e.telegraph, false);
      });
      for (const [handle, k] of Object.entries(P.arena.party)) {
        const c = byKey.get(k);
        if (!c) continue;
        const ch2 = P.characters.find((x) => x.handle === handle);
        const dead = ch2 ? !ch2.alive : false;
        token(c, "#123240", k === P.meKey ? "#e0b64d" : "#3f8fb0", (ch2?.name || handle).slice(0, 1).toUpperCase(), ch2?.hp_cur ?? 1, ch2?.hp_max ?? 1, dead, ch2?.status_effects, false, k === P.meKey);
      }

      const live: Floater[] = [];
      for (const f of floatersRef.current) {
        const age = (now - f.born) / 1000;
        if (age > 1.1) continue;
        live.push(f);
        const c = byKey.get(f.key);
        if (!c) continue;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = f.color;
        ctx.font = `800 ${Math.round(size * 0.8)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(f.text, c.x, c.y - size * 0.8 - age * size * 1.6);
        ctx.globalAlpha = 1;
      }
      floatersRef.current = live;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [dims, size, floatersRef]);

  const cellAt = (ev: React.MouseEvent<HTMLCanvasElement>): Cell | null => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    let best: Cell | null = null, bestD = Infinity;
    for (const c of cellsRef.current) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best && bestD <= (size * 0.95) ** 2 ? best : null;
  };

  const active = moveSet || targetSet;

  return (
    <div ref={wrapRef} className="w-full overflow-hidden rounded-[10px]" style={{ background: "#070c12", border: "1px solid var(--frp-line)" }}>
      <canvas
        ref={ref}
        onClick={(e) => { const c = cellAt(e); if (c) onCellClick(c.key); }}
        onMouseMove={(e) => onHoverCell(cellAt(e)?.key ?? null)}
        onMouseLeave={() => onHoverCell(null)}
        style={{ display: "block", cursor: active ? "pointer" : "default" }}
      />
    </div>
  );
}

export function BattleMap({
  campaign, characters, me, onBattleMove, onBattleAbility, busy,
}: {
  campaign: Campaign;
  characters: Character[];
  me: string;
  onBattleMove: (key: string) => void;
  onBattleAbility: (ability: string, target: string) => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<{ kind: "move" } | { kind: "ability"; ability: Ability } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const floatersRef = useRef<Floater[]>([]);
  const fid = useRef(0);
  const prevHp = useRef<Map<string, number>>(new Map());

  const arena = campaign.encounter?.active ? campaign.encounter.arena : undefined;
  const enemies = useMemo(() => campaign.encounter?.enemies || [], [campaign.encounter]);
  const myChar = characters.find((c) => c.handle === me);
  const isMyTurn = campaign.status === "active" && campaign.current_turn === me && !!myChar?.alive;
  const meKey = arena && myChar ? arena.party[me] || null : null;
  const canAct = isMyTurn && !busy && !!arena && !!meKey;

  useEffect(() => {
    if (!arena) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const seen = new Set<string>();
    enemies.forEach((e, i) => {
      const k = arena.enemies[i];
      if (!k) return;
      const id = `e${i}`;
      seen.add(id);
      const prev = prevHp.current.get(id);
      if (prev !== undefined && e.hp < prev) floatersRef.current.push({ id: fid.current++, key: k, text: `-${prev - e.hp}`, color: "#ff8a7a", born: now });
      prevHp.current.set(id, e.hp);
    });
    for (const [h, k] of Object.entries(arena.party)) {
      const c = characters.find((x) => x.handle === h);
      if (!c) continue;
      const id = `p${h}`;
      seen.add(id);
      const prev = prevHp.current.get(id);
      if (prev !== undefined && c.hp_cur !== prev) floatersRef.current.push({ id: fid.current++, key: k, text: c.hp_cur > prev ? `+${c.hp_cur - prev}` : `-${prev - c.hp_cur}`, color: c.hp_cur > prev ? "#7fe0a0" : "#ff8a7a", born: now });
      prevHp.current.set(id, c.hp_cur);
    }
    for (const id of [...prevHp.current.keys()]) if (!seen.has(id)) prevHp.current.delete(id);
  }, [enemies, characters, arena]);

  const abilities = useMemo(() => (myChar ? abilitiesFor(myChar.abilities) : []), [myChar]);

  const moveSet = useMemo(() => {
    if (!arena || !canAct || !meKey || mode?.kind !== "move") return null;
    return new Set(arenaReachable(arena, meKey, battleMoveBudget(myChar!.class, myChar!.class2)).keys());
  }, [arena, canAct, meKey, mode, myChar]);

  const { targetSet, rangeSet } = useMemo(() => {
    if (!arena || !canAct || !meKey || mode?.kind !== "ability") return { targetSet: null, rangeSet: null };
    const ab = mode.ability;
    const range = new Set(axialRange(parseKey(meKey), ab.range).map((a) => hexKey(a.q, a.r)));
    const targets = new Set<string>();
    if (ab.target === "enemy") {
      enemies.forEach((e, i) => {
        const k = arena.enemies[i];
        if (e.hp > 0 && k && inRange(meKey, k, ab.range) && (!ab.needsLoS || hasLoS(arena, meKey, k))) targets.add(k);
      });
    } else if (ab.target === "ally") {
      for (const [h, k] of Object.entries(arena.party)) {
        const c = characters.find((x) => x.handle === h);
        if (c?.alive && inRange(meKey, k, ab.range)) targets.add(k);
      }
    }
    return { targetSet: targets, rangeSet: range };
  }, [arena, canAct, meKey, mode, enemies, characters]);

  const aoeSet = useMemo(() => {
    if (mode?.kind !== "ability" || !hover || !targetSet?.has(hover)) return null;
    return new Set(aoeHexes(hover, mode.ability.aoe));
  }, [mode, hover, targetSet]);

  if (!arena) return null;

  const pickAbility = (ab: Ability) => {
    if (!canAct) return;
    if (ab.target === "self") { setMode(null); onBattleAbility(ab.id, ""); return; }
    setMode({ kind: "ability", ability: ab });
  };

  const onCellClick = (key: string) => {
    if (mode?.kind === "move" && moveSet?.has(key)) { setMode(null); onBattleMove(key); }
    else if (mode?.kind === "ability" && targetSet?.has(key)) { const ab = mode.ability; setMode(null); onBattleAbility(ab.id, key); }
  };

  const alreadyMoved = (arena.moved || []).includes(me);
  const terrainsHere = new Set(Object.values(arena.terrain));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
        <span className="inline-flex items-center gap-1">
          <Swords className="size-[11px]" strokeWidth={2} /> Savaş alanı
        </span>
        <span style={{ color: canAct ? "var(--frp-accent-ink)" : "var(--frp-muted)" }}>
          {!isMyTurn ? "sıra sende değil" : mode?.kind === "ability" ? `${mode.ability.tr}: hedef seç` : mode?.kind === "move" ? "gidilecek altıgene tıkla" : "yeteneğini seç"}
        </span>
      </div>

      <BattleCanvas arena={arena} characters={characters} enemies={enemies} moveSet={moveSet} targetSet={targetSet} rangeSet={rangeSet} aoeSet={aoeSet} meKey={meKey} floatersRef={floatersRef} onCellClick={onCellClick} onHoverCell={setHover} />

      {canAct ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setMode(mode?.kind === "move" ? null : { kind: "move" })} disabled={alreadyMoved} className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40" style={mode?.kind === "move" ? { background: "var(--frp-accent)", color: "#fff" } : { background: "var(--frp-track)", color: "var(--frp-ink-soft)" }}>
            <Footprints className="size-[12px]" strokeWidth={2} /> Mevzilen
          </button>
          {abilities.map((ab) => {
            const noMp = (myChar?.mp_cur ?? 0) < ab.mp;
            const on = mode?.kind === "ability" && mode.ability.id === ab.id;
            return (
              <button key={ab.id} type="button" onClick={() => pickAbility(ab)} disabled={noMp} title={ab.desc} className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-35" style={on ? { background: "var(--frp-danger)", color: "#fff" } : { background: "var(--frp-track)", color: "var(--frp-ink-soft)" }}>
                <Sparkles className="size-[11px]" strokeWidth={2} /> {ab.tr}
                {ab.mp > 0 ? <span style={{ color: on ? "rgba(255,255,255,0.8)" : "var(--frp-accent-ink)" }}>{ab.mp}m</span> : null}
              </button>
            );
          })}
          {mode ? (
            <button type="button" onClick={() => setMode(null)} className="inline-flex items-center rounded-[7px] px-2 py-1 text-[11px]" style={{ color: "var(--frp-muted)" }}>iptal</button>
          ) : null}
        </div>
      ) : null}

      {terrainsHere.size ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px]" style={{ color: "var(--frp-muted)" }}>
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
