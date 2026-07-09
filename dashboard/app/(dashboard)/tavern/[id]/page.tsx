import { getSession } from "@/lib/session";
import { getCampaign, getCharacters, getTurns } from "@/lib/frp/db";
import { getWorld } from "@/lib/frp/world";
import { GameView } from "@/components/frp/game-view";
import { JoinPanel } from "@/components/frp/join-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const handle = session ? me(session) : "";
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) notFound();
  const campaign = await getCampaign(cid);
  if (!campaign) notFound();
  const [characters, turns, world] = await Promise.all([
    getCharacters(cid),
    getTurns(cid, 0, 400),
    getWorld(),
  ]);
  const joined = characters.some((c) => c.handle === handle);
  const isHost = campaign.host === handle || session?.role === "admin";

  return (
    <div className="rise">
      <Link
        href="/tavern"
        className="mb-5 inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <ChevronLeft className="size-4" /> Meyhane
      </Link>

      <div className="frp-page">
        <header className="mb-7">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]" style={{ color: "var(--frp-ink)" }}>
            {campaign.title}
          </h1>
          <p className="mt-2 max-w-[760px] text-[13.5px] leading-relaxed" style={{ color: "var(--frp-muted)" }}>
            {campaign.setting}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: "var(--frp-faint)" }}>
            <span>kurucu @{campaign.host}</span>
            <span>·</span>
            <span>takımda {characters.length} kişi</span>
          </div>
        </header>

        {campaign.status === "lobby" && !joined ? (
          <div className="mb-7 max-w-[600px]">
            <JoinPanel id={cid} difficulty={campaign.difficulty} />
          </div>
        ) : null}

        <GameView
          id={cid}
          initialCampaign={campaign}
          initialCharacters={characters}
          initialTurns={turns}
          initialWorld={world}
          me={handle}
          isHost={isHost}
          joined={joined}
        />
      </div>
    </div>
  );
}
