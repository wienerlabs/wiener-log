"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, RACES, CLASS_TR, RACE_TR } from "@/lib/frp/classes";
import { HOUSES } from "@/lib/frp/houses";
import { PixelPortrait, PixelSprite } from "@/components/frp/pixel";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

const TRAITS = ["Cesur", "Kurnaz", "Bilge", "Acımasız", "Sadık", "Karanlık"];
const STEPS = ["İsim", "Sınıf", "Irk", "Tabiat", "Hanedan"];

export function JoinPanel({
  id,
  difficulty = "normal",
}: {
  id: number;
  difficulty?: string;
}) {
  const router = useRouter();
  const dualAllowed = difficulty === "easy" || difficulty === "normal";
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [cls, setCls] = useState(CLASSES[0].id);
  const [cls2, setCls2] = useState<string | null>(null);
  const [race, setRace] = useState(RACES[0].id);
  const [trait, setTrait] = useState(TRAITS[0]);
  const [house, setHouse] = useState(HOUSES[0].id);
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState("kahraman:warrior:human");

  useEffect(() => {
    const to = setTimeout(
      () => setSeed(`${name || "kahraman"}:${cls}:${race}`),
      160,
    );
    return () => clearTimeout(to);
  }, [name, cls, race]);

  const clsTr = CLASS_TR[cls];
  const cls2Tr = cls2 ? CLASS_TR[cls2] : null;

  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/frp/${id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, cls, cls2: dualAllowed ? cls2 : null, race, trait, house }),
      });
      if (res.ok) router.refresh();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  const pickPrimary = (cid: string) => {
    setCls(cid);
    if (cls2 === cid) setCls2(null);
  };

  return (
    <div className="rounded-[16px] p-5" style={{ background: "var(--frp-surface)", border: "1px solid var(--frp-line)" }}>
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-[12px] p-1.5" style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}>
          <PixelPortrait seed={seed} race={race} cell={8} />
        </div>
        <div>
          <div className="text-[16px] font-semibold" style={{ color: "var(--frp-ink)" }}>
            {name || "Yeni bir kahraman"}
          </div>
          <div className="text-[12px]" style={{ color: "var(--frp-muted)" }}>
            {RACE_TR[race]?.name} {clsTr?.name}
            {cls2Tr ? ` / ${cls2Tr.name}` : ""} · {trait} · {HOUSES.find((h) => h.id === house)?.name}
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="flex h-6 flex-1 items-center justify-center rounded-full text-[10.5px] font-semibold transition-colors"
            style={{
              background: i === step ? "var(--frp-accent)" : i < step ? "var(--frp-accent-soft)" : "var(--frp-line-soft)",
              color: i === step ? "#fff" : i < step ? "var(--frp-accent-ink)" : "var(--frp-faint)",
            }}
          >
            {s}
          </div>
        ))}
      </div>

      {step === 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>Karakterinin adı</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Örn. Kael Alacakaranlık"
            className="w-full rounded-[11px] px-3.5 py-2.5 text-[14px] outline-none"
            style={{ background: "var(--frp-canvas)", border: "1px solid var(--frp-line)", color: "var(--frp-ink)" }}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CLASSES.map((c) => {
              const tr = CLASS_TR[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickPrimary(c.id)}
                  className="rounded-[12px] border p-3 text-left transition-colors"
                  style={{
                    borderColor: cls === c.id ? "var(--frp-accent)" : "var(--frp-line)",
                    background: cls === c.id ? "var(--frp-accent-soft)" : "var(--frp-canvas)",
                  }}
                >
                  <div className="text-[13px] font-semibold" style={{ color: "var(--frp-ink)" }}>{tr?.name}</div>
                  <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--frp-muted)" }}>{tr?.blurb}</div>
                  <div className="mt-1.5 text-[10px] font-medium" style={{ color: "var(--frp-accent-ink)" }}>
                    {c.hp} can · {c.mp} mana · {tr?.ability}
                  </div>
                </button>
              );
            })}
          </div>
          {dualAllowed ? (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
                İkinci sınıf (isteğe bağlı, {difficulty === "easy" ? "kolay" : "normal"} zorlukta)
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCls2(null)}
                  className="rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors"
                  style={{
                    background: !cls2 ? "var(--frp-ink)" : "var(--frp-canvas)",
                    color: !cls2 ? "var(--frp-canvas)" : "var(--frp-muted)",
                    border: "1px solid var(--frp-line)",
                  }}
                >
                  Yok
                </button>
                {CLASSES.filter((c) => c.id !== cls).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCls2(c.id)}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors"
                    style={{
                      background: cls2 === c.id ? "var(--frp-accent)" : "var(--frp-canvas)",
                      color: cls2 === c.id ? "#fff" : "var(--frp-muted)",
                      border: "1px solid var(--frp-line)",
                    }}
                  >
                    {CLASS_TR[c.id]?.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {RACES.map((r) => {
            const tr = RACE_TR[r.id];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRace(r.id)}
                className="flex flex-col items-center rounded-[12px] border p-3 text-center transition-colors"
                style={{
                  borderColor: race === r.id ? "var(--frp-accent)" : "var(--frp-line)",
                  background: race === r.id ? "var(--frp-accent-soft)" : "var(--frp-canvas)",
                }}
              >
                <div className="rounded-[10px] p-1.5" style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}>
                  <PixelSprite name={`race_${r.id}`} cell={5} />
                </div>
                <div className="mt-2 text-[13px] font-semibold" style={{ color: "var(--frp-ink)" }}>{tr?.name}</div>
                <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--frp-muted)" }}>{tr?.blurb}</div>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.05em]" style={{ color: "var(--frp-faint)" }}>
            Karakterinin tabiatı
          </div>
          <div className="flex flex-wrap gap-2">
            {TRAITS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrait(t)}
                className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors"
                style={{
                  background: trait === t ? "var(--frp-accent)" : "var(--frp-canvas)",
                  color: trait === t ? "#fff" : "var(--frp-muted)",
                  border: "1px solid var(--frp-line)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {HOUSES.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHouse(h.id)}
              className="flex flex-col items-center rounded-[12px] border p-3 text-center transition-colors"
              style={{
                borderColor: house === h.id ? "var(--frp-accent)" : "var(--frp-line)",
                background: house === h.id ? "var(--frp-accent-soft)" : "var(--frp-canvas)",
              }}
            >
              <div className="rounded-[8px] p-1" style={{ background: "#00000010", border: "1px solid var(--frp-line)" }}>
                <PixelSprite name={h.sprite} cell={4} />
              </div>
              <div className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--frp-ink)" }}>{h.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--frp-muted)" }}>{h.blurb}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-30"
          style={{ color: "var(--frp-muted)" }}
        >
          <ChevronLeft className="size-4" /> Geri
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && !name.trim()}
            className="inline-flex items-center gap-1 rounded-[10px] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--frp-accent)" }}
          >
            İleri <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={join}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--frp-accent)" }}
          >
            <Check className="size-4" /> {busy ? "Katılıyor..." : "Takıma katıl"}
          </button>
        )}
      </div>
    </div>
  );
}
