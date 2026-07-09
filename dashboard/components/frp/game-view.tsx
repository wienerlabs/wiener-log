"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterCard } from "@/components/frp/character-card";
import { Transcript } from "@/components/frp/transcript";
import { PixelSprite, PixelBar } from "@/components/frp/pixel";
import type { Campaign, Character, Turn } from "@/lib/frp/types";
import {
  Wand2,
  SendHorizontal,
  Play,
  SkipForward,
  Pause,
  Square,
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
  const lastId = useRef(initialTurns.reduce((m, t) => Math.max(m, t.id), 0));
  const endRef = useRef<HTMLDivElement>(null);

  const isMyTurn =
    campaign.status === "active" && campaign.current_turn === me;
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
      <div className="min-w-0">
        <div
          className={`mb-4 flex items-center justify-between rounded-[12px] px-4 py-2.5 text-[13px] font-medium ${
            isMyTurn
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "bg-[var(--color-surface)] text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)]"
          }`}
        >
          {campaign.status === "lobby" ? (
            <span>The party is gathering. Waiting for the host to begin.</span>
          ) : campaign.status === "ended" ? (
            <span>This saga has ended.</span>
          ) : campaign.status === "paused" ? (
            <span>The tale is paused.</span>
          ) : isMyTurn ? (
            <span>Your move, {myChar?.name || "traveller"}. The world holds its breath.</span>
          ) : (
            <span>The world waits on {turnName}.</span>
          )}
          <span className="text-[11px] text-[var(--color-faint)]">Round {campaign.round}</span>
        </div>

        {campaign.encounter?.active ? (
          <div className="mb-4 rounded-[14px] bg-[var(--color-danger-soft)] p-4 ring-1 ring-[var(--color-danger)]">
            <div className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
              <Swords className="size-[14px]" strokeWidth={2} />
              {campaign.encounter.name}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {campaign.encounter.enemies.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="shrink-0 rounded-[8px] bg-[var(--color-canvas)] p-1 ring-1 ring-[var(--color-ring)]">
                    <PixelSprite name={e.sprite} cell={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-medium text-[var(--color-ink)]">
                      {e.name}
                    </div>
                    <PixelBar value={e.hp} max={e.hp_max} color="#da3633" seg={8} height={7} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-canvas)] p-4 sm:p-5">
          {turns.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[var(--color-faint)]">
              The story has not begun. The host opens the world.
            </div>
          ) : (
            <Transcript turns={turns} characters={charMap} />
          )}
          {thinking ? (
            <div className="mt-4 flex items-center gap-2 rounded-[12px] border-l-[3px] border-[var(--color-accent)] bg-[var(--color-surface)] p-4 text-[13px] text-[var(--color-muted)]">
              <Wand2 className="size-[14px] animate-pulse text-[var(--color-accent)]" strokeWidth={2} />
              <span className="animate-pulse">The Game Master weaves the tale...</span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {joined && campaign.status === "active" ? (
          <div className="mt-4">
            {campaign.status === "active" ? (
              <div className="mb-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => isMyTurn && myChar?.alive && setMode("action")}
                  disabled={!isMyTurn || !myChar?.alive}
                  className={`rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    mode === "action"
                      ? "bg-[var(--color-accent)] text-[var(--color-btn-fg)]"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)] disabled:opacity-40"
                  }`}
                >
                  Action
                </button>
                <button
                  type="button"
                  onClick={() => setMode("talk")}
                  className={`rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    mode === "talk"
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)]"
                  }`}
                >
                  Table talk
                </button>
              </div>
            ) : null}
            {campaign.status === "active" ? (
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
                      ? "Describe what your character does..."
                      : "Say something to the table (out of character)..."
                  }
                  className="flex-1 resize-none rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={sending || !text.trim()}
                  className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--color-accent)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <SendHorizontal className="size-[18px]" strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {isHost ? (
          <div className="flex flex-wrap gap-1.5 rounded-[12px] bg-[var(--color-surface)] p-2 ring-1 ring-[var(--color-ring)]">
            {campaign.status === "lobby" ? (
              <HostBtn onClick={() => control("start")} disabled={sending} icon={Play} label="Begin saga" primary />
            ) : null}
            {campaign.status === "active" ? (
              <>
                <HostBtn onClick={() => control("skip")} disabled={sending} icon={SkipForward} label="Skip" />
                <HostBtn onClick={() => control("pause")} disabled={sending} icon={Pause} label="Pause" />
              </>
            ) : null}
            {campaign.status === "paused" ? (
              <HostBtn onClick={() => control("resume")} disabled={sending} icon={Play} label="Resume" />
            ) : null}
            {campaign.status !== "ended" ? (
              <HostBtn onClick={() => control("end")} disabled={sending} icon={Square} label="End" />
            ) : null}
          </div>
        ) : null}

        <div className="text-[11px] font-semibold tracking-[0.06em] text-[var(--color-faint)]">
          Party
        </div>
        {myChar ? <CharacterCard character={myChar} isTurn={campaign.current_turn === me} /> : null}
        {characters
          .filter((c) => c.handle !== me)
          .map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              isTurn={campaign.current_turn === c.handle}
              compact
            />
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
      className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 ${
        primary
          ? "bg-[var(--color-accent)] text-white hover:opacity-90"
          : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
      }`}
    >
      <Icon className="size-[13px]" strokeWidth={2} />
      {label}
    </button>
  );
}
