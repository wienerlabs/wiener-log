"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { Avatar } from "@/components/ui";

type ActiveMeeting = {
  room: string;
  title: string | null;
  created_by: string | null;
  participants: string[];
};

export function CallBar() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveMeeting[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/meet/active");
        if (r.ok) setActive(((await r.json()) as { meetings: ActiveMeeting[] }).meetings);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = await fetch("/api/meet/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Team call" }),
      });
      if (r.ok) {
        const d = (await r.json()) as { room: string };
        router.push(`/meet/${d.room}`);
      }
    } catch {
      /* ignore */
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="inline-flex items-center gap-2 rounded-[11px] bg-[var(--color-btn)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          <Video className="size-[16px]" strokeWidth={2} />
          {starting ? "Starting…" : "Start a call"}
        </button>
      </div>

      {active.map((m) => (
        <div
          key={m.room}
          className="flex items-center gap-3 rounded-[12px] bg-[var(--color-ok-soft)] px-4 py-2.5 ring-1 ring-[var(--color-ok)]/25"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-ok)] opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--color-ok)]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[var(--color-ink)]">
              {m.title || "Team call"}
            </div>
            <div className="text-[11.5px] text-[var(--color-muted)]">
              {m.participants.length} in call
            </div>
          </div>
          <div className="flex -space-x-2">
            {m.participants.slice(0, 4).map((h) => (
              <Avatar key={h} handle={h} size={24} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/meet/${m.room}`)}
            className="rounded-[9px] bg-[var(--color-ok)] px-3 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
