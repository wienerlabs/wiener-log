import { PixelPortrait, PixelSprite } from "@/components/frp/pixel";
import { DiceRoll } from "@/components/frp/dice";
import { locationByKey } from "@/lib/frp/locations";
import { houseById } from "@/lib/frp/houses";
import { itemById, itemNameTr, RARITY_COLOR, RARITY_TR, type Rarity } from "@/lib/frp/items";
import type { Character, Turn, HiddenRoll, Herald } from "@/lib/frp/types";
import { Wand2, Skull, Sparkles, Swords, Star } from "lucide-react";

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
    const locKey = (t.payload?.location as string | undefined) || null;
    const loc = locKey ? locationByKey(locKey) : null;
    const heralds = (t.payload?.heralds as Herald[] | undefined) || [];
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
        {heralds.length ? (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {heralds.map((h, i) => {
              const house = houseById(h.house);
              if (!house) return null;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2"
                  style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}
                >
                  <PixelSprite name={house.sprite} cell={2} />
                  {h.royal ? <PixelSprite name="it_crown" cell={2} /> : null}
                  <span className="text-[11px] font-medium" style={{ color: "var(--frp-ink-soft)" }}>
                    {h.name}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}
        {loc ? (
          <figure
            className={`mb-3 overflow-hidden rounded-[10px] ${loc.big ? "" : "float-right ml-3"}`}
            style={{
              border: "1px solid var(--frp-line)",
              maxWidth: loc.big ? 440 : 156,
              width: loc.big ? "100%" : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/frp/loc/${loc.key}.webp`} alt={loc.tr} className="block w-full" />
            <figcaption className="px-2 py-1 text-[10px] font-medium" style={{ background: "var(--frp-surface)", color: "var(--frp-muted)" }}>
              {loc.tr}
            </figcaption>
          </figure>
        ) : null}
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
          {actor ? <PixelPortrait seed={actor.portrait_seed} race={actor.race} cell={3} /> : <div className="size-9" />}
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
    const item = (t.payload?.item as string) || "";
    const def = itemById(item);
    const rarity = ((t.payload?.rarity as string) || def?.rarity || "common") as Rarity;
    const color = RARITY_COLOR[rarity] || "#8b949e";
    return (
      <div
        className="rise mx-auto flex max-w-[360px] items-center gap-2.5 rounded-[12px] p-2.5"
        style={{ background: "var(--frp-surface)", border: `1.5px solid ${color}`, boxShadow: `0 0 14px ${color}44` }}
      >
        {def ? (
          <div className="rounded-[8px] p-1" style={{ background: "#00000010", border: `1px solid ${color}` }}>
            <PixelSprite name={def.sprite} cell={3} glow={rarity === "legendary" || rarity === "epic" ? color : undefined} />
          </div>
        ) : (
          <Sparkles className="size-[16px]" style={{ color }} strokeWidth={2} />
        )}
        <div>
          <div className="text-[12.5px] font-semibold" style={{ color: "var(--frp-ink)" }}>
            {def ? itemNameTr(item) : item}
          </div>
          <div className="text-[10px] font-medium" style={{ color }}>
            {RARITY_TR[rarity] || rarity} · {t.actor} buldu
          </div>
        </div>
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

  if (t.kind === "levelup") {
    return (
      <div className="rise mx-auto flex max-w-[520px] items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--frp-accent-soft)", color: "var(--frp-accent-ink)", border: "1px solid var(--frp-accent)" }}>
        <Star className="size-[14px] shrink-0" fill="currentColor" strokeWidth={0} />
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

  if (t.kind === "system" && (t.payload as { warning?: boolean } | null)?.warning) {
    return (
      <div className="mx-auto flex max-w-[520px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 text-center text-[12px] font-medium" style={{ background: "var(--frp-danger-soft)", color: "var(--frp-danger)" }}>
        <span aria-hidden>⚠</span>
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
