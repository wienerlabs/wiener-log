import { getSession } from "@/lib/session";
import { listCampaigns } from "@/lib/frp/db";
import { Card, PageHeader, SectionHeader, EmptyState } from "@/components/ui";
import { CreateCampaign } from "@/components/frp/create-campaign";
import { Users, Check, Swords } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function me(s: { handle: string; username: string }): string {
  return s.handle && s.handle !== "admin" ? s.handle : s.username;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  lobby: { label: "Gathering", color: "var(--color-muted)", bg: "var(--color-line-soft)" },
  active: { label: "In play", color: "var(--color-ok)", bg: "var(--color-ok-soft)" },
  paused: { label: "Paused", color: "var(--color-warn)", bg: "var(--color-warn-soft)" },
};

export default async function TavernPage() {
  const session = await getSession();
  const handle = session ? me(session) : "";
  const campaigns = await listCampaigns(handle);

  return (
    <div className="rise">
      <PageHeader
        title="Tavern"
        subtitle="Gather a party, wake a Game Master, and walk into a living world."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionHeader title="Open sagas" action={<span>{campaigns.length}</span>} />
          {campaigns.length === 0 ? (
            <EmptyState>No sagas yet. Forge the first one.</EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((c) => {
                const st = STATUS[c.status] || STATUS.lobby;
                return (
                  <Link key={c.id} href={`/tavern/${c.id}`}>
                    <Card className="p-4 transition-transform duration-300 hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                              {c.title}
                            </span>
                            {c.joined ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                                <Check className="size-[10px]" strokeWidth={3} /> joined
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 max-w-[560px] text-[12.5px] text-[var(--color-muted)]">
                            {c.setting}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                          style={{ color: st.color, background: st.bg }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-[11.5px] text-[var(--color-faint)]">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-[13px]" strokeWidth={2} /> {c.party_size}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Swords className="size-[13px]" strokeWidth={2} /> round {c.round}
                        </span>
                        <span className="capitalize">{c.difficulty}</span>
                        <span>host @{c.host}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <SectionHeader title="New saga" />
          <CreateCampaign />
        </div>
      </div>
    </div>
  );
}
