"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Swords, Check, Skull, Crown, Dot, Trash2 } from "lucide-react";
import { PixelPortrait, PixelSprite } from "@/components/frp/pixel";
import { MapThumb } from "@/components/frp/map-thumb";
import { houseById } from "@/lib/frp/houses";
import type { CampaignListRow } from "@/lib/frp/types";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  lobby: { label: "Toplanıyor", color: "#c9a24a", bg: "rgba(201,162,74,0.16)" },
  active: { label: "Oyunda", color: "#5bb06a", bg: "rgba(91,176,106,0.16)" },
  paused: { label: "Duraklatıldı", color: "#c98a4a", bg: "rgba(201,138,74,0.16)" },
};

const DIFF: Record<string, string> = { easy: "Kolay", normal: "Normal", hard: "Zor", grim: "Acımasız" };

type Tab = "all" | "mine" | "lobby";

function leadingHouse(factions: Record<string, number> | null): string | null {
  if (!factions) return null;
  const e = Object.entries(factions).filter(([k]) => houseById(k));
  if (!e.length) return null;
  e.sort((a, b) => b[1] - a[1]);
  return e[0][1] > 50 ? e[0][0] : null;
}

function CampaignCard({ c, me }: { c: CampaignListRow; me: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const st = STATUS[c.status] || STATUS.lobby;
  const party = c.party || [];
  const lead = leadingHouse(c.factions);
  const leadHouse = lead ? houseById(lead) : null;
  const turnName = c.current_turn ? party.find((p) => p.handle === c.current_turn)?.name || `@${c.current_turn}` : null;
  const doom = c.doom || 0;
  const canDelete = c.status === "lobby" && (c.host === me || me === "admin");

  const del = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!confirm(`"${c.title}" efsanesini silmek istediğine emin misin? Bu geri alınamaz.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/frp/${c.id}`, { method: "DELETE" });
      if (r.ok) router.refresh();
      else {
        const d = await r.json().catch(() => ({}));
        alert(d.error || "silinemedi");
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  };

  return (
    <Link href={`/tavern/${c.id}`} className="group block">
      <div
        className="overflow-hidden rounded-[16px] transition-all duration-300 group-hover:-translate-y-1"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <div className="relative" style={{ background: "#081726" }}>
          {c.map_seed ? (
            <MapThumb seed={c.map_seed} />
          ) : (
            <div className="flex h-[150px] items-center justify-center text-[11px]" style={{ color: "#4a5a6a" }}>
              düğüm haritası
            </div>
          )}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(6,12,18,0.86) 0%, rgba(6,12,18,0.15) 42%, rgba(6,12,18,0) 70%)" }} />
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}44` }}>
              {c.status === "active" ? <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full align-middle" style={{ background: st.color }} /> : null}
              {st.label}
            </span>
            {c.joined ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(120,180,255,0.18)] px-1.5 py-0.5 text-[10px] font-medium text-[#9cc4ff]">
                <Check className="size-[10px]" strokeWidth={3} /> katıldın
              </span>
            ) : null}
          </div>
          {doom > 0 ? (
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm" style={{ color: "#e8a0a0", background: "rgba(40,12,16,0.6)", border: "1px solid rgba(200,80,80,0.35)" }}>
              <Skull className="size-[11px]" strokeWidth={2} /> {doom}
            </div>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={del}
              disabled={busy}
              aria-label="Efsaneyi sil"
              title="Bu boş efsaneyi sil"
              className="absolute right-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors disabled:opacity-50"
              style={{ color: "#e8a0a0", background: "rgba(40,12,16,0.65)", border: "1px solid rgba(200,80,80,0.4)" }}
            >
              <Trash2 className="size-[13px]" strokeWidth={2} />
            </button>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
            <h3 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-white drop-shadow">{c.title}</h3>
            {leadHouse ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                <Crown className="size-[10px]" strokeWidth={2} /> {leadHouse.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-3.5">
          <p className="line-clamp-2 text-[12px] leading-relaxed" style={{ color: "var(--color-muted)" }}>{c.setting}</p>
          {doom > 0 ? (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--color-line-soft)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, doom)}%`, background: "linear-gradient(to right, #a3564f, #d16050)" }} />
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {party.length ? (
                <div className="flex -space-x-2">
                  {party.slice(0, 4).map((p, i) => (
                    <span key={i} className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full ring-2" style={{ background: "var(--color-canvas)", ["--tw-ring-color" as string]: "var(--color-surface)" }} title={p.name}>
                      <PixelPortrait seed={p.seed} race={p.race} cell={2} />
                    </span>
                  ))}
                  {party.length > 4 ? (
                    <span className="inline-flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2" style={{ background: "var(--color-line-soft)", color: "var(--color-muted)", ["--tw-ring-color" as string]: "var(--color-surface)" }}>
                      +{party.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11.5px]" style={{ color: "var(--color-faint)" }}>
                  <Users className="size-[13px]" strokeWidth={2} /> boş
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--color-faint)" }}>
              <span className="inline-flex items-center gap-1">
                <Swords className="size-[12px]" strokeWidth={2} /> {c.round}. tur
              </span>
              <span>{DIFF[c.difficulty] || c.difficulty}</span>
            </div>
          </div>
          {c.status === "active" && turnName ? (
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--color-accent)" }}>
              <Dot className="size-[16px] animate-pulse" strokeWidth={5} /> sıra: {turnName}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function CampaignBoard({ campaigns, me }: { campaigns: CampaignListRow[]; me: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const counts = useMemo(
    () => ({
      all: campaigns.length,
      mine: campaigns.filter((c) => c.joined).length,
      lobby: campaigns.filter((c) => c.status === "lobby").length,
    }),
    [campaigns],
  );
  const shown = useMemo(() => {
    if (tab === "mine") return campaigns.filter((c) => c.joined);
    if (tab === "lobby") return campaigns.filter((c) => c.status === "lobby");
    return campaigns;
  }, [campaigns, tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Tümü" },
    { id: "mine", label: "Katıldıkların" },
    { id: "lobby", label: "Toplananlar" },
  ];

  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-1 rounded-full p-1" style={{ background: "var(--color-line-soft)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={tab === t.id ? { background: "var(--color-surface)", color: "var(--color-ink)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: "var(--color-muted)" }}
          >
            {t.label} <span style={{ color: "var(--color-faint)" }}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[16px] p-10 text-center text-[13px]" style={{ background: "var(--color-surface)", border: "1px dashed var(--color-line)", color: "var(--color-faint)" }}>
          {tab === "mine" ? "Henüz bir efsaneye katılmadın." : tab === "lobby" ? "Toplanan takım yok. İlkini sen kur." : "Henüz efsane yok. İlkini döv."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shown.map((c) => (
            <CampaignCard key={c.id} c={c} me={me} />
          ))}
        </div>
      )}
    </div>
  );
}
