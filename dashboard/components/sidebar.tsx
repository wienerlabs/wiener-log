"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  House,
  FolderGit2,
  GitPullRequestArrow,
  CircleDot,
  Compass,
  Users,
  FolderKanban,
  MessagesSquare,
  FileText,
  BarChart3,
  Settings,
  UserPlus,
  ListChecks,
  Radio,
  LayoutGrid,
  Megaphone,
  Sunrise,
  Target,
  Network,
  Radar,
  LogOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { langColor } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

const primary = [
  { href: "/", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/repos", label: "Repositories", icon: FolderGit2 },
  { href: "/pulls", label: "Pull requests", icon: GitPullRequestArrow },
  { href: "/issues", label: "Issues", icon: CircleDot },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chat", label: "Team chat", icon: MessagesSquare },
  { href: "/vault", label: "Vault", icon: FileText },
  { href: "/members", label: "Members", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/settings", label: "Settings", icon: Settings },
];

const company = [
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/standups", label: "Standups", icon: Sunrise },
  { href: "/goals", label: "Goals", icon: Target },
];

const signals = [
  { href: "/briefing", label: "Briefing", icon: Radar },
  { href: "/expertise", label: "Expertise", icon: Network },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/events", label: "Events", icon: Radio },
  { href: "/workspaces", label: "Workspaces", icon: LayoutGrid },
];

export type SidebarPin = {
  full_name: string;
  name: string;
  language: string | null;
  is_private: boolean;
};

function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof House;
  active: boolean;
}) {
  return (
    <Link
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
}

export function Sidebar({
  logoutAction,
  role = "admin",
  handle = "admin",
  pinned = [],
  topics = [],
}: {
  logoutAction?: () => void;
  role?: string;
  handle?: string;
  pinned?: SidebarPin[];
  topics?: string[];
}) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  const isAdmin = role === "admin";
  const primaryNav = isAdmin
    ? primary
    : primary.filter(
        (n) =>
          n.href !== "/members" &&
          n.href !== "/onboarding" &&
          n.href !== "/reports",
      );

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-glass)] px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-white ring-1 ring-black/[0.08]">
          <Image
            src="/wiener-logo.png"
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

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("wlog:search"))}
          className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line-soft)]"
        >
          <Search className="size-[15px] text-[var(--color-faint)]" strokeWidth={2} />
          <span className="flex-1 text-left">Search</span>
          <span className="rounded-[5px] bg-[var(--color-line-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-faint)]">
            ⌘K
          </span>
        </button>
        <NotificationBell />
      </div>

      <nav className="flex flex-col gap-0.5">
        {primaryNav.map((n) => (
          <NavItem
            key={n.href}
            href={n.href}
            label={n.label}
            Icon={n.icon}
            active={isActive(n.href)}
          />
        ))}
      </nav>

      <div className="mt-6">
        <div className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--color-faint)]">
          Company
        </div>
        <nav className="flex flex-col gap-0.5">
          {company.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              label={n.label}
              Icon={n.icon}
              active={isActive(n.href)}
            />
          ))}
        </nav>
      </div>

      {isAdmin ? (
        <div className="mt-6">
          <div className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--color-faint)]">
            Signals
          </div>
          <nav className="flex flex-col gap-0.5">
            {signals.map((n) => (
              <NavItem
                key={n.href}
                href={n.href}
                label={n.label}
                Icon={n.icon}
                active={isActive(n.href)}
              />
            ))}
          </nav>
        </div>
      ) : null}

      {pinned.length ? (
        <div className="mt-6">
          <div className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--color-faint)]">
            Pinned
          </div>
          <div className="flex flex-col gap-0.5">
            {pinned.map((p) => (
              <Link
                key={p.full_name}
                href={`/repos?q=${encodeURIComponent(p.name)}`}
                className="group flex items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-[13px] text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
              >
                <span
                  className="inline-block size-[9px] shrink-0 rounded-full ring-1 ring-[var(--color-ring)]"
                  style={{ backgroundColor: langColor(p.language) }}
                />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {topics.length ? (
        <div className="mt-6">
          <div className="px-3 pb-2 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--color-faint)]">
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {topics.map((t) => (
              <Link
                key={t}
                href={`/explore?topic=${encodeURIComponent(t)}`}
                className="rounded-full bg-[var(--color-line-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex-1" />

      <div className="mb-2">
        <ThemeToggle />
      </div>

      <div className="rounded-[12px] bg-[var(--color-line-soft)] px-3 py-3">
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

      <div className="mt-2 flex items-center justify-between rounded-[10px] px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[var(--color-ink)]">
            {handle && handle !== "admin" ? `@${handle}` : "Admin"}
          </div>
          <div className="text-[11px] text-[var(--color-faint)]">
            {role === "admin" ? "Full access" : "Team member"}
          </div>
        </div>
        {logoutAction ? (
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-[9px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-danger)]"
            >
              <LogOut className="size-[16px]" strokeWidth={2} />
            </button>
          </form>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[var(--color-line)] bg-[var(--color-glass)] px-5 py-3.5 backdrop-blur-xl lg:hidden">
      <span className="flex size-7 items-center justify-center rounded-[9px] bg-white ring-1 ring-black/[0.08]">
        <Image
          src="/wiener-logo.png"
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
