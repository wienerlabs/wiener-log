"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ListChecks,
  FolderGit2,
  Users,
  Radio,
  Boxes,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/members", label: "Members", icon: Users },
  { href: "/workspaces", label: "Workspaces", icon: FolderGit2 },
  { href: "/repos", label: "Repositories", icon: Boxes },
  { href: "/events", label: "Events", icon: Radio },
];

export function Sidebar({ logoutAction }: { logoutAction?: () => void }) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-[var(--color-line)] bg-white/70 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-[var(--color-ink)]">
          <Image
            src="/wiener-logo-white.png"
            alt="Wiener Labs"
            width={40}
            height={28}
            className="h-[13px] w-auto"
            priority
          />
        </span>
        <div className="leading-none">
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            WienerLog
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-faint)]">
            control plane
          </div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
                active
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]",
              )}
            >
              <Icon
                className={cn(
                  "size-[17px] transition-colors",
                  active
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-faint)] group-hover:text-[var(--color-ink-soft)]",
                )}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-[12px] bg-[var(--color-line-soft)] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-ok)] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--color-ok)]" />
          </span>
          <span className="text-[12px] font-medium text-[var(--color-ink-soft)]">
            Live on Railway
          </span>
        </div>
        <div className="mt-1 pl-4 text-[11px] text-[var(--color-faint)]">
          Neon + ingest + engine
        </div>
      </div>

      {logoutAction ? (
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line-soft)] hover:text-[var(--color-danger)]"
          >
            <LogOut className="size-[16px]" strokeWidth={2} />
            Sign out
          </button>
        </form>
      ) : null}
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[var(--color-line)] bg-white/80 px-5 py-3.5 backdrop-blur-xl lg:hidden">
      <span className="flex size-7 items-center justify-center rounded-[9px] bg-[var(--color-ink)]">
        <Image
          src="/wiener-logo-white.png"
          alt="Wiener Labs"
          width={40}
          height={28}
          className="h-[11px] w-auto"
          priority
        />
      </span>
      <span className="text-[14px] font-semibold tracking-[-0.01em]">
        WienerLog
      </span>
    </div>
  );
}
