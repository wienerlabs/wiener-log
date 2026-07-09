"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui";

type Notif = {
  id: number;
  actor: string | null;
  kind: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function label(n: Notif): string {
  if (n.kind === "mention") return `@${n.actor} mentioned you`;
  if (n.kind === "task") return `@${n.actor} assigned you a task`;
  if (n.kind === "announcement") return "New announcement";
  if (n.kind === "frp_turn") return n.body || "Your turn in a saga";
  return n.kind;
}

export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [toasts, setToasts] = useState<Notif[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const seenMax = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const d = (await res.json()) as { notifications: Notif[]; unread: number };
        setUnread(d.unread);
        setItems(d.notifications);
        const maxId = d.notifications.reduce((a, n) => Math.max(a, n.id), 0);
        if (mounted.current) {
          const fresh = d.notifications.filter(
            (n) => n.id > seenMax.current && !n.read,
          );
          if (fresh.length) {
            setToasts((prev) => [...fresh, ...prev].slice(0, 4));
            fresh.forEach((n) =>
              setTimeout(
                () => setToasts((p) => p.filter((t) => t.id !== n.id)),
                6000,
              ),
            );
          }
        }
        seenMax.current = Math.max(seenMax.current, maxId);
        mounted.current = true;
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 12000);
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    const next = !open;
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: Math.max(12, r.left) });
    }
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      try {
        await fetch("/api/notifications", { method: "POST" });
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {
        /* ignore */
      }
    }
  };

  const goto = (link: string | null) => {
    setOpen(false);
    if (link) router.push(link);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Notifications"
        className="relative flex size-9 items-center justify-center rounded-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line-soft)] hover:text-[var(--color-ink)]"
      >
        <Bell className="size-[18px]" strokeWidth={2} />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-[15px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
              <div
                style={{ top: pos.top, left: pos.left }}
                className="fixed z-[100] w-[300px] overflow-hidden rounded-[14px] bg-[var(--color-surface)] ring-1 ring-[var(--color-ring)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
              >
                <div className="border-b border-[var(--color-line)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--color-ink)]">
                  Notifications
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[12.5px] text-[var(--color-faint)]">
                      Nothing yet.
                    </div>
                  ) : (
                    items.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => goto(n.link)}
                        className="flex w-full items-start gap-2.5 border-b border-[var(--color-line-soft)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-line-soft)]"
                      >
                        {n.actor ? <Avatar handle={n.actor} size={26} /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium text-[var(--color-ink)]">
                            {label(n)}
                          </div>
                          {n.body ? (
                            <div className="truncate text-[11.5px] text-[var(--color-muted)]">
                              {n.body}
                            </div>
                          ) : null}
                          <div className="text-[10.5px] text-[var(--color-faint)]">
                            {relativeTime(n.created_at)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}

      {toasts.length
        ? createPortal(
            <div className="fixed right-4 top-4 z-[110] flex w-[320px] flex-col gap-2">
              {toasts.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setToasts((p) => p.filter((t) => t.id !== n.id));
                    goto(n.link);
                  }}
                  className="rise flex items-start gap-2.5 rounded-[12px] bg-[var(--color-surface)] px-4 py-3 text-left ring-1 ring-[var(--color-ring)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
                >
                  {n.actor ? <Avatar handle={n.actor} size={28} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-[var(--color-ink)]">
                      {label(n)}
                    </div>
                    {n.body ? (
                      <div className="truncate text-[11.5px] text-[var(--color-muted)]">
                        {n.body}
                      </div>
                    ) : null}
                  </div>
                  <X
                    className="size-[14px] shrink-0 text-[var(--color-faint)]"
                    strokeWidth={2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setToasts((p) => p.filter((t) => t.id !== n.id));
                    }}
                  />
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
