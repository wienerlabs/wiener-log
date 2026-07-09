"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Sparkles } from "lucide-react";

const DEFAULT_SETTING =
  "A continent where the gods forged seven cursed weapons, one for each deadly sin. Each weapon corrupts whoever wields it, turning them into the sin itself. If all seven are gathered, the Seventh Seal breaks and the world ends. The party begins as nobodies caught in the hunt for the sin weapons, hunted by cults, kings, and worse.";

const DIFFICULTIES = ["easy", "normal", "hard", "grim"];

export function CreateCampaign() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [setting, setSetting] = useState(DEFAULT_SETTING);
  const [tone, setTone] = useState("grim, novelistic, morally grey");
  const [difficulty, setDifficulty] = useState("normal");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/frp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, setting, tone, difficulty }),
      });
      const d = (await res.json()) as { id?: number };
      if (d.id) router.push(`/tavern/${d.id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
        <Sparkles className="size-[15px] text-[var(--color-accent)]" strokeWidth={2} />
        Forge a new saga
      </div>
      <div className="flex flex-col gap-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Saga title"
          className="rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        />
        <textarea
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          rows={4}
          placeholder="Setting: the world the Game Master will run"
          className="resize-none rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        />
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Tone"
          className="rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex items-center gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                difficulty === d
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-canvas)] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy || !title.trim()}
          className="mt-1 rounded-[11px] bg-[var(--color-btn)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Forging..." : "Create saga"}
        </button>
      </div>
    </Card>
  );
}
