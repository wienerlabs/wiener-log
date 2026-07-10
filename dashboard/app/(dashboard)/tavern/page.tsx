import { getSession } from "@/lib/session";
import { listCampaigns } from "@/lib/frp/db";
import { SectionHeader } from "@/components/ui";
import { CreateCampaign } from "@/components/frp/create-campaign";
import { CampaignBoard } from "@/components/frp/campaign-board";
import { PixelSprite } from "@/components/frp/pixel";
import { HOUSES } from "@/lib/frp/houses";
import { Skull, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

const HOUSE_COLOR: Record<string, string> = {
  kanli_tac: "#b0483f", kara_kuzgun: "#6a6178", gumus_kurt: "#7c8a99",
  altin_aslan: "#c8912e", yesil_yilan: "#3f7a4a", kizil_gul: "#b0506a",
};

export default async function TavernPage() {
  const session = await getSession();
  const handle = session ? me(session) : "";
  const campaigns = await listCampaigns(handle);
  const active = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="rise">
      <section
        className="relative mb-6 overflow-hidden rounded-[20px] p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #14100f 0%, #241417 55%, #2c1620 100%)",
          border: "1px solid rgba(176,80,106,0.28)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle, #b0506a 0%, transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#c98ea0" }}>
            <Skull className="size-[13px]" strokeWidth={2} /> Yedinci Mühür yükseliyor
          </div>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[38px]">
            Meyhane
          </h1>
          <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed" style={{ color: "#c9b6bb" }}>
            Bir takım topla, bir Anlatıcı uyandır ve tohumdan doğan yaşayan bir dünyaya adım at. Altı hanedan taht için savaşırken her efsane kendi haritasını, kendi kaderini örer.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            {HOUSES.map((h) => (
              <div key={h.id} className="flex items-center gap-2">
                <span className="inline-flex size-8 items-center justify-center rounded-[7px]" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${HOUSE_COLOR[h.id]}55` }}>
                  <PixelSprite name={h.sprite} cell={2} />
                </span>
                <div className="leading-tight">
                  <div className="text-[11.5px] font-semibold text-white/90">{h.name}</div>
                  <div className="h-[2px] w-full rounded-full" style={{ background: HOUSE_COLOR[h.id] }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 text-[11.5px]" style={{ color: "#9a8288" }}>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-[13px]" strokeWidth={2} style={{ color: "#c98ea0" }} /> {campaigns.length} açık efsane
            </span>
            {active ? <span>{active} tanesi şu an oyunda</span> : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionHeader title="Açık efsaneler" />
          <CampaignBoard campaigns={campaigns} me={handle} />
        </div>
        <div>
          <SectionHeader title="Yeni efsane" />
          <CreateCampaign />
        </div>
      </div>
    </div>
  );
}
