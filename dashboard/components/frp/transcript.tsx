import { PixelPortrait } from "@/components/frp/pixel";
import type { Character, Turn } from "@/lib/frp/types";
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
    return (
      <div className="rise rounded-[14px] border-l-[3px] border-[var(--color-accent)] bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-ring)]">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--color-accent)]">
          <Wand2 className="size-[13px]" strokeWidth={2} />
          Game Master
        </div>
        <div className="whitespace-pre-wrap text-[14px] leading-[1.7] text-[var(--color-ink)]">
          {t.content}
        </div>
      </div>
    );
  }

  if (t.kind === "action") {
    return (
      <div className="flex items-start gap-2.5 pl-1">
        <div className="mt-0.5 shrink-0 rounded-[7px] bg-[var(--color-canvas)] p-0.5 ring-1 ring-[var(--color-ring)]">
          {actor ? (
            <PixelPortrait seed={actor.portrait_seed} cell={3} />
          ) : (
            <div className="size-9" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-[var(--color-ink)]">
            {actor?.name || t.actor}
          </span>
          <span className="ml-1.5 text-[11px] text-[var(--color-faint)]">acts</span>
          <div className="text-[13.5px] italic leading-relaxed text-[var(--color-ink-soft)]">
            {t.content}
          </div>
        </div>
      </div>
    );
  }

  if (t.kind === "talk") {
    return (
      <div className="pl-1 text-[12.5px] text-[var(--color-muted)]">
        <span className="font-medium text-[var(--color-ink-soft)]">@{t.actor}</span>
        <span className="mx-1 text-[var(--color-faint)]">(table)</span>
        {t.content}
      </div>
    );
  }

  if (t.kind === "loot") {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--color-ok)]">
        <Sparkles className="size-[13px]" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "transform") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] bg-[var(--color-purple-soft)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--color-purple)]">
        <Sparkles className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "death") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] bg-[var(--color-danger-soft)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-danger)]">
        <Skull className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  if (t.kind === "combat") {
    return (
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[10px] bg-[var(--color-danger-soft)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--color-danger)]">
        <Swords className="size-[14px] shrink-0" strokeWidth={2} />
        {t.content}
      </div>
    );
  }

  return (
    <div className="mx-auto rounded-full bg-[var(--color-line-soft)] px-3 py-1 text-center text-[11.5px] text-[var(--color-faint)]">
      {t.content}
    </div>
  );
}
