"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

const DEFAULT_SETTING =
  "Tanrıların, yedi ölümcül günahı mühürlemek için yedi lanetli silah dövdüğü bir kıta. Her silah, onu kuşananı temsil ettiği günaha dönüştürür. Yedisi bir araya gelirse Yedinci Mühür kırılır ve dünya son bulur. Takım, silahların peşindeki tarikatlar, krallar ve daha beteri tarafından kovalanan sıradan insanlar olarak başlar.";

const DIFFICULTIES: { id: string; label: string }[] = [
  { id: "easy", label: "Kolay" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Zor" },
  { id: "grim", label: "Acımasız" },
];

export function CreateCampaign() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [setting, setSetting] = useState(DEFAULT_SETTING);
  const [tone, setTone] = useState("karanlık, roman havasında, gri ahlak");
  const [difficulty, setDifficulty] = useState("normal");
  const [model, setModel] = useState("claude-haiku-4-5");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/frp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, setting, tone, difficulty, model }),
      });
      const d = (await res.json()) as { id?: number };
      if (d.id) router.push(`/tavern/${d.id}`);
    } catch {
      setBusy(false);
    }
  };

  const field = {
    background: "var(--frp-surface)",
    border: "1px solid var(--frp-line)",
    color: "var(--frp-ink)",
  } as const;

  return (
    <div className="frp-page">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--frp-ink)" }}>
        <Sparkles className="size-[16px]" style={{ color: "var(--frp-accent)" }} strokeWidth={2} />
        Yeni bir efsane döv
      </div>
      <div className="flex flex-col gap-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Efsanenin adı"
          className="rounded-[11px] px-3.5 py-2 text-[13.5px] outline-none"
          style={field}
        />
        <textarea
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          rows={5}
          placeholder="Dünya: Anlatıcının yürüteceği evren"
          className="resize-none rounded-[11px] px-3.5 py-2.5 text-[13px] leading-relaxed outline-none"
          style={field}
        />
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Ton"
          className="rounded-[11px] px-3.5 py-2 text-[13px] outline-none"
          style={field}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className="rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: difficulty === d.id ? "var(--frp-accent)" : "var(--frp-surface)",
                color: difficulty === d.id ? "#fff" : "var(--frp-muted)",
                border: "1px solid var(--frp-line)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "claude-haiku-4-5", label: "Hızlı (Haiku)" },
            { id: "claude-sonnet-4-5", label: "Sinematik (Sonnet)" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              className="rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: model === m.id ? "var(--frp-accent)" : "var(--frp-surface)",
                color: model === m.id ? "#fff" : "var(--frp-muted)",
                border: "1px solid var(--frp-line)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="-mt-1 text-[10.5px]" style={{ color: "var(--frp-faint)" }}>
          Hızlı: kısa, çabuk turlar. Sinematik: daha zengin ama yavaş anlatım.
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy || !title.trim()}
          className="mt-1 rounded-[11px] px-4 py-2.5 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--frp-accent)" }}
        >
          {busy ? "Dövülüyor..." : "Efsaneyi yarat"}
        </button>
      </div>
    </div>
  );
}
