"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterCard } from "@/components/frp/character-card";
import { Transcript } from "@/components/frp/transcript";
import { PixelSprite, PixelBar } from "@/components/frp/pixel";
import { ThinkingDice } from "@/components/frp/dice";
import { FireOverlay } from "@/components/frp/fire-overlay";
import type { Campaign, Character, Turn } from "@/lib/frp/types";
import {
  SendHorizontal,
  Play,
  SkipForward,
  Pause,
  Square,
  RotateCcw,
  Swords,
} from "lucide-react";

export function GameView({
  id,
  initialCampaign,
  initialCharacters,
  initialTurns,
  me,
  isHost,
  joined,
}: {
  id: number;
  initialCampaign: Campaign;
  initialCharacters: Character[];
  initialTurns: Turn[];
  me: string;
  isHost: boolean;
  joined: boolean;
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [characters, setCharacters] = useState(initialCharacters);
  const [turns, setTurns] = useState(initialTurns);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"action" | "talk">("talk");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [fireTrigger, setFireTrigger] = useState(0);
  const lastId = useRef(initialTurns.reduce((m, t) => Math.max(m, t.id), 0));
  const endRef = useRef<HTMLDivElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const isMyTurn = campaign.status === "active" && campaign.current_turn === me;
  const myChar = characters.find((c) => c.handle === me);

  useEffect(() => {
    if (isMyTurn && myChar?.alive) setMode("action");
    else setMode("talk");
  }, [isMyTurn, myChar?.alive]);

  const poll = async () => {
    try {
      const res = await fetch(`/api/frp/${id}?after=${lastId.current}`);
      if (!res.ok) return;
      const d = (await res.json()) as {
        campaign: Campaign;
        characters: Character[];
        turns: Turn[];
      };
      setCampaign(d.campaign);
      setCharacters(d.characters);
      if (d.turns.length) {
        setTurns((prev) => [...prev, ...d.turns]);
        lastId.current = d.turns.reduce((m, t) => Math.max(m, t.id), lastId.current);
        if (d.turns.some((t) => t.kind === "narration" && (t.payload as { fire?: boolean } | null)?.fire))
          setFireTrigger((f) => f + 1);
      } else if (d.turns.length === 0 && lastId.current > 0 && d.campaign.round === 0) {
        setTurns([]);
        lastId.current = 0;
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, [id]);

  useEffect(() => {
    const el = scrollBoxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length, thinking]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    if (mode === "action") setThinking(true);
    setText("");
    try {
      await fetch(`/api/frp/${id}/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, mode }),
      });
      await poll();
    } catch {
      /* ignore */
    }
    setSending(false);
    setThinking(false);
  };

  const control = async (c: string) => {
    if (sending) return;
    if (c === "restart" && !window.confirm("Hikâye sıfırlanacak ve takım tam canla lobiye dönecek. Emin misin?")) return;
    setSending(true);
    if (c === "start") setThinking(true);
    try {
      await fetch(`/api/frp/${id}/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ control: c }),
      });
      await poll();
    } catch {
      /* ignore */
    }
    setSending(false);
    setThinking(false);
  };

  const charMap: Record<string, Character> = {};
  for (const c of characters) charMap[c.handle] = c;
  const turnName = campaign.current_turn
    ? charMap[campaign.current_turn]?.name || `@${campaign.current_turn}`
    : "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <FireOverlay trigger={fireTrigger} />
      <div className="min-w-0">
        <div
          className="mb-4 flex items-center justify-between rounded-[12px] px-4 py-2.5 text-[13px] font-medium"
          style={{
            background: isMyTurn ? "var(--frp-accent-soft)" : "var(--frp-surface)",
            color: isMyTurn ? "var(--frp-accent-ink)" : "var(--frp-ink-soft)",
            border: "1px solid var(--frp-line)",
          }}
        >
          {campaign.status === "lobby" ? (
            <span>Takım toplanıyor. Anlatıcının başlatmasını bekliyor.</span>
          ) : campaign.status === "ended" ? (
            <span>Bu efsane sona erdi.</span>
          ) : campaign.status === "paused" ? (
            <span>Hikâye duraklatıldı.</span>
          ) : isMyTurn ? (
            <span>Sıra sende, {myChar?.name || "yolcu"}. Dünya nefesini tuttu.</span>
          ) : (
            <span>Dünya {turnName} oyuncusunu bekliyor.</span>
          )}
          <span className="text-[11px]" style={{ color: "var(--frp-faint)" }}>{campaign.round}. tur</span>
        </div>

        {campaign.encounter?.active ? (
          <div className="mb-4 rounded-[14px] p-4" style={{ background: "var(--frp-danger-soft)", border: "1px solid var(--frp-danger)" }}>
            <div className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--frp-danger)" }}>
              <Swords className="size-[14px]" strokeWidth={2} />
              {campaign.encounter.name}
              {campaign.encounter.kind === "boss" ? (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide text-white" style={{ background: "var(--frp-danger)" }}>BOSS</span>
              ) : campaign.encounter.kind === "dungeon" ? (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide" style={{ background: "var(--frp-corrupt)", color: "#fff" }}>ZİNDAN</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {campaign.encounter.enemies.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="shrink-0 rounded-[8px] p-1" style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}>
                    <PixelSprite name={e.sprite} cell={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-medium" style={{ color: "var(--frp-ink)" }}>{e.name}</div>
                    <PixelBar value={e.hp} max={e.hp_max} color="var(--frp-danger)" seg={8} height={7} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div ref={scrollBoxRef} className="max-h-[64vh] overflow-y-auto rounded-[16px] p-4 sm:p-5" style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)" }}>
          {turns.length === 0 ? (
            <div className="py-16 text-center text-[13px]" style={{ color: "var(--frp-faint)" }}>
              Hikâye henüz başlamadı. Anlatıcı dünyayı açacak.
            </div>
          ) : (
            <Transcript turns={turns} characters={charMap} />
          )}
          {thinking ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-[12px] border-l-[3px] p-4 text-[13px]" style={{ borderColor: "var(--frp-accent)", background: "var(--frp-raised)", color: "var(--frp-muted)" }}>
              <ThinkingDice size={22} />
              <span>Anlatıcı düşünüyor</span>
              <span className="frp-bob inline-block" style={{ color: "var(--frp-accent)" }}>...</span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {joined && campaign.status === "active" ? (
          <div className="mt-4">
            <div className="mb-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => isMyTurn && myChar?.alive && setMode("action")}
                disabled={!isMyTurn || !myChar?.alive}
                className="rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
                style={{
                  background: mode === "action" ? "var(--frp-accent)" : "var(--frp-surface)",
                  color: mode === "action" ? "#fff" : "var(--frp-muted)",
                  border: "1px solid var(--frp-line)",
                }}
              >
                Eylem
              </button>
              <button
                type="button"
                onClick={() => setMode("talk")}
                className="rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: mode === "talk" ? "var(--frp-ink)" : "var(--frp-surface)",
                  color: mode === "talk" ? "var(--frp-canvas)" : "var(--frp-muted)",
                  border: "1px solid var(--frp-line)",
                }}
              >
                Masa sohbeti
              </button>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                rows={2}
                placeholder={
                  mode === "action"
                    ? "Karakterin ne yapıyor, anlat..."
                    : "Masaya bir şey söyle (rol dışı)..."
                }
                className="flex-1 resize-none rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)", color: "var(--frp-ink)" }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={sending || !text.trim()}
                className="flex size-11 items-center justify-center rounded-[12px] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--frp-accent)" }}
              >
                <SendHorizontal className="size-[18px]" strokeWidth={2} />
              </button>
            </div>
            {mode === "action" && !isMyTurn ? (
              <div className="mt-1.5 text-[11px]" style={{ color: "var(--frp-faint)" }}>
                Sıran değil, ama masada konuşabilirsin.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        {isHost ? (
          <div className="flex flex-wrap gap-1.5 rounded-[12px] p-2" style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}>
            {campaign.status === "lobby" ? (
              <HostBtn onClick={() => control("start")} disabled={sending} icon={Play} label="Efsaneyi başlat" primary />
            ) : null}
            {campaign.status === "active" ? (
              <>
                <HostBtn onClick={() => control("skip")} disabled={sending} icon={SkipForward} label="Atla" />
                <HostBtn onClick={() => control("pause")} disabled={sending} icon={Pause} label="Duraklat" />
              </>
            ) : null}
            {campaign.status === "paused" ? (
              <HostBtn onClick={() => control("resume")} disabled={sending} icon={Play} label="Devam et" />
            ) : null}
            {campaign.status !== "lobby" ? (
              <HostBtn onClick={() => control("restart")} disabled={sending} icon={RotateCcw} label="Yeniden başlat" />
            ) : null}
            {campaign.status !== "ended" && campaign.status !== "lobby" ? (
              <HostBtn onClick={() => control("end")} disabled={sending} icon={Square} label="Bitir" />
            ) : null}
          </div>
        ) : null}

        <div className="text-[11px] font-semibold tracking-[0.06em]" style={{ color: "var(--frp-faint)" }}>
          Takım
        </div>
        {myChar ? <CharacterCard character={myChar} isTurn={campaign.current_turn === me} /> : null}
        {characters
          .filter((c) => c.handle !== me)
          .map((c) => (
            <CharacterCard key={c.id} character={c} isTurn={campaign.current_turn === c.handle} compact />
          ))}
      </div>
    </div>
  );
}

function HostBtn({
  onClick,
  disabled,
  icon: Icon,
  label,
  primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Play;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
      style={
        primary
          ? { background: "var(--frp-accent)", color: "#fff" }
          : { color: "var(--frp-ink-soft)" }
      }
    >
      <Icon className="size-[13px]" strokeWidth={2} />
      {label}
    </button>
  );
}
