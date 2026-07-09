import { PixelPortrait } from "@/components/frp/pixel";
import { DiceRoll } from "@/components/frp/dice";
import type { Character, Turn, HiddenRoll } from "@/lib/frp/types";
import { Wand2, Skull, Sparkles, Swords } from "lucide-react";

export function Transcript({
  turns,
  characters,
}: {
  turns: Turn[];
  characters: Record<string, Character>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {turns.map((t) => (
        <TurnBlock key={t.id} turn={t} characters={characters} />
      ))}
    </div>
  );
}

function TurnBlock({
  turn: t,
  characters,
}: {
  turn: Turn;
  characters: Record<string, Character>;
}) {
  const actor = characters[t.actor];

  if (t.kind === "narration") {
    const rolls = (t.payload?.rolls as HiddenRoll[] | undefined) || [];
    return (
      <div
        className="rise rounded-[14px] border-l-[3px] p-4"
        style={{
          borderColor: "var(--frp-accent)",
          background: "var(--frp-raised)",
          boxShadow: "0 1px 2px #0000000f",
        }}
      >
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em]" style={{ color: "var(--frp-accent-ink)" }}>
          <Wand2 className="size-[13px]" strokeWidth={2} />
          Anlatıcı
        </div>
        <div className="whitespace-pre-wrap text-[14px] leading-[1.75]" style={{ color: "var(--frp-ink)" }}>
          {t.content}
        </div>
        {rolls.length ? (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3" style={{ borderColor: "var(--frp-line)" }}>
            {rolls.slice(0, 4).map((r, i) => (
              <DiceRoll key={i} sides={r.die || 20} value={r.result} label={r.label} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (t.kind === "action") {
    return (
      <div className="flex items-start gap-2.5 pl-1">
        <div className="mt-0.5 shrink-0 rounded-[7px] p-0.5" style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}>
          {actor ? <PixelPortrait seed={actor.portrait_seed} cell={3} /> : <div className="size-9" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-semibold" style={{ color: "var(--frp-ink)" }}>
            {actor?.name || t.actor}
          </span>
          <div className="text-[13.5px] italic leading-relaxed" style={{ color: "var(--frp-ink-soft)" }}>
            {t.content}
          </div>
        </div>
      </div>
    );
  }

  if (t.kind === "talk") {
    return (
      <div className="pl-1 text-[12.5px]" style={{ color: "var(--frp-muted)" }}>
        <span className="font-medium" style={{ color: "var(--frp-ink-soft)" }}>@{t.actor}</span>
        <span className="mx-1" style={{ color: "var(--frp-faint)" }}>(masa)</span>
        {t.content}
      </div>
    );
  }

  if (t.kind === "loot") {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium" style={{ color: "#7a5a2a" }}>
        <Sparkles className="size-[13px]" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "transform") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-medium" style={{ background: "#8a5a9a1a", color: "var(--frp-corrupt)" }}>
        <Sparkles className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "death") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--frp-danger-soft)", color: "var(--frp-danger)" }}>
        <Skull className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "combat") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-medium" style={{ background: "var(--frp-danger-soft)", color: "var(--frp-danger)" }}>
        <Swords className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  return (
    <div className="mx-auto rounded-full px-3 py-1 text-center text-[11.5px]" style={{ background: "var(--frp-line-soft)", color: "var(--frp-faint)" }}>
      {t.content}
    </div>
  );
}
