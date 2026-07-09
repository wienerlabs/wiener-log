import { cn, relativeTime, formatNumber } from "@/lib/utils";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  GitFork,
  Scale,
  MessageSquare,
  GitPullRequestArrow,
  CircleDot,
  Milestone,
} from "lucide-react";
import type { GhRepo, GhPull, GhIssue } from "@/lib/db";

export function Avatar({
  handle,
  src,
  size = 36,
}: {
  handle: string;
  src?: string | null;
  size?: number;
}) {
  const url = src || `https://github.com/${handle}.png?size=${size * 2}`;
  return (
    <Image
      src={url}
      alt={handle}
      width={size}
      height={size}
      className="rounded-full bg-[var(--color-line-soft)] object-cover ring-1 ring-[var(--color-ring)]"
      style={{ width: size, height: size }}
    />
  );
}

const orgStyles: Record<string, string> = {
  wienerlabs: "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
  "S-SIDEWINDER": "bg-[var(--color-sidewinder-soft)] text-[var(--color-sidewinder)]",
};

export function OrgBadge({ org }: { org: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        orgStyles[org] ?? "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
      )}
    >
      {org}
    </span>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] bg-[var(--color-surface)] ring-1 ring-[var(--color-ring)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
      <div className="text-[13px] font-medium text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-[12.5px] text-[var(--color-faint)]">{sub}</div>
      ) : null}
    </Card>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
        {title}
      </h2>
      {action ? (
        <div className="text-[13px] text-[var(--color-muted)]">{action}</div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-[14px] text-[var(--color-muted)]">{subtitle}</p>
      ) : null}
    </header>
  );
}

const sourceStyles: Record<string, string> = {
  git: "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
  github: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  claude_code: "bg-[var(--color-purple-soft)] text-[var(--color-purple)]",
};

export function SourcePill({ source }: { source: string }) {
  const label = source === "claude_code" ? "claude" : source;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium",
        sourceStyles[source] ?? "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
      )}
    >
      {label}
    </span>
  );
}

const statusStyles: Record<string, { c: string; dot: string; label: string }> = {
  proposed: { c: "text-[var(--color-muted)]", dot: "#a1a1aa", label: "Proposed" },
  acked: { c: "text-[var(--color-ok)]", dot: "#1a7f45", label: "Acked" },
  in_progress: { c: "text-[var(--color-info)]", dot: "#0060b0", label: "In progress" },
  done: { c: "text-[var(--color-ok)]", dot: "#1a7f45", label: "Done" },
  rejected: { c: "text-[var(--color-danger)]", dot: "#c0362c", label: "Rejected" },
};

export function StatusPill({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusStyles.proposed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium", s.c)}>
      <span
        className="inline-block size-[7px] rounded-full"
        style={{ backgroundColor: s.dot }}
      />
      {s.label}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-muted)]">
      {children}
    </span>
  );
}

export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)]/40 px-6 py-16 text-center text-[13.5px] text-[var(--color-faint)]">
      {children}
    </div>
  );
}

const langColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Python: "#3572A5",
  Go: "#00ADD8",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Java: "#b07219",
  Ruby: "#701516",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5a03",
  Solidity: "#AA6746",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Nix: "#7e7eff",
  MDX: "#fcb32c",
  PHP: "#4F5D95",
  Lua: "#000080",
  Zig: "#ec915c",
  Jupyter: "#DA5B0B",
  "Jupyter Notebook": "#DA5B0B",
  TeX: "#3D6117",
  Roff: "#ecdebe",
  Haskell: "#5e5086",
};

export function langColor(language: string | null | undefined): string {
  if (!language) return "#c4c4cc";
  return langColors[language] ?? "#9ca3af";
}

export function LanguageDot({
  language,
  withLabel = true,
}: {
  language: string | null;
  withLabel?: boolean;
}) {
  if (!language) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)]">
      <span
        className="inline-block size-[10px] rounded-full ring-1 ring-[var(--color-ring)]"
        style={{ backgroundColor: langColor(language) }}
      />
      {withLabel ? language : null}
    </span>
  );
}

function hexReadable(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#3f3f46";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.7 ? "#3f3f46" : hex;
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  const hex = `#${(color || "d1d5db").replace("#", "")}`;
  const text = hexReadable(hex);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: text,
        backgroundColor: `${hex}1f`,
        boxShadow: `inset 0 0 0 1px ${hex}55`,
      }}
    >
      {name}
    </span>
  );
}

export function CIBadge({ ci }: { ci: string | null }) {
  if (!ci) return null;
  const map: Record<string, { c: string; label: string }> = {
    passing: { c: "text-[var(--color-ok)]", label: "Checks passing" },
    pending: { c: "text-[var(--color-warn)]", label: "Checks running" },
    failing: { c: "text-[var(--color-danger)]", label: "Checks failing" },
  };
  const s = map[ci];
  if (!s) return null;
  const dot =
    ci === "passing" ? "#1a7f45" : ci === "pending" ? "#9a6a00" : "#c0362c";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px]", s.c)}>
      <span
        className="inline-block size-[7px] rounded-full"
        style={{ backgroundColor: dot }}
      />
      {s.label}
    </span>
  );
}

const priorityMap: Record<string, { dot: string; label: string; c: string }> = {
  critical: { dot: "#c0362c", label: "Critical", c: "text-[var(--color-danger)]" },
  high: { dot: "#c2691c", label: "High", c: "text-[#b15c15]" },
  medium: { dot: "#0060b0", label: "Medium", c: "text-[var(--color-info)]" },
  low: { dot: "#71717a", label: "Low", c: "text-[var(--color-muted)]" },
};

export function priorityMeta(priority: string) {
  return priorityMap[priority] ?? priorityMap.low;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const s = priorityMeta(priority);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", s.c)}>
      <span className="inline-block size-[7px] rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

export function VisibilityBadge({ isPrivate }: { isPrivate: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1",
        isPrivate
          ? "bg-[var(--color-line-soft)] text-[var(--color-muted)] ring-[var(--color-ring)]"
          : "bg-[var(--color-ok-soft)] text-[var(--color-ok)] ring-[var(--color-ok)]/20",
      )}
    >
      {isPrivate ? "Private" : "Public"}
    </span>
  );
}

const heatScale = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
];

export function Heatmap({
  cells,
}: {
  cells: { date: string; count: number }[];
}) {
  const max = Math.max(1, ...cells.map((c) => c.count));
  const level = (n: number) => {
    if (n === 0) return 0;
    const r = n / max;
    if (r > 0.66) return 4;
    if (r > 0.33) return 3;
    if (r > 0.12) return 2;
    return 1;
  };
  const lead = cells.length ? new Date(cells[0].date).getDay() : 0;
  const padded = [...Array(lead).fill(null), ...cells];
  const weeks: (typeof cells[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {Array.from({ length: 7 }).map((_, di) => {
            const cell = week[di];
            if (!cell)
              return <span key={di} className="size-[11px] rounded-[3px] bg-transparent" />;
            return (
              <span
                key={di}
                title={`${cell.date} · ${cell.count} events`}
                className="size-[11px] rounded-[3px] ring-1 ring-[var(--color-ring)]"
                style={{ backgroundColor: heatScale[level(cell.count)] }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {data.map((v, i) => (
        <span
          key={i}
          className="w-full flex-1 rounded-[2px] bg-[var(--color-accent)]/25"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function InlineStat({
  icon: Icon,
  children,
}: {
  icon: typeof Star;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted)]">
      <Icon className="size-[13px] text-[var(--color-faint)]" strokeWidth={2} />
      {children}
    </span>
  );
}

export function RepoCard({ repo }: { repo: GhRepo }) {
  return (
    <Card className="flex h-full flex-col p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--color-accent)] transition-opacity hover:opacity-70"
        >
          {repo.name}
        </a>
        <VisibilityBadge isPrivate={repo.is_private} />
      </div>

      <p className="mt-2 line-clamp-2 min-h-[38px] text-[13px] leading-[1.45] text-[var(--color-muted)]">
        {repo.description || "No description provided."}
      </p>

      {repo.topics.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-accent)]"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4">
        {repo.language ? <LanguageDot language={repo.language} /> : null}
        {repo.stars > 0 ? (
          <InlineStat icon={Star}>{formatNumber(repo.stars)}</InlineStat>
        ) : null}
        {repo.forks > 0 ? (
          <InlineStat icon={GitFork}>{formatNumber(repo.forks)}</InlineStat>
        ) : null}
        {repo.license ? (
          <InlineStat icon={Scale}>{repo.license}</InlineStat>
        ) : null}
        <span className="ml-auto text-[11.5px] text-[var(--color-faint)]">
          {relativeTime(repo.pushed_at)}
        </span>
      </div>
    </Card>
  );
}

export function PullRow({ pull }: { pull: GhPull }) {
  const [, short] = pull.repo.split("/");
  return (
    <a
      href={pull.html_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-line-soft)]"
    >
      <GitPullRequestArrow
        className={cn(
          "mt-0.5 size-[17px] shrink-0",
          pull.draft ? "text-[var(--color-faint)]" : "text-[var(--color-ok)]",
        )}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
            {pull.title}
          </span>
          {pull.draft ? (
            <span className="rounded-full bg-[var(--color-line-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
              Draft
            </span>
          ) : null}
          {pull.labels.slice(0, 3).map((l) => (
            <LabelChip key={l.name} name={l.name} color={l.color} />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-faint)]">
          <span className="font-[family-name:var(--font-mono)]">
            {short} #{pull.number}
          </span>
          <span>
            opened {relativeTime(pull.created_at)}
            {pull.author ? ` by ${pull.author}` : ""}
          </span>
          {pull.ci ? <CIBadge ci={pull.ci} /> : null}
          {pull.additions != null || pull.deletions != null ? (
            <span className="font-[family-name:var(--font-mono)]">
              <span className="text-[var(--color-ok)]">
                +{pull.additions ?? 0}
              </span>{" "}
              <span className="text-[var(--color-danger)]">
                -{pull.deletions ?? 0}
              </span>
            </span>
          ) : null}
          {pull.comments > 0 ? (
            <InlineStat icon={MessageSquare}>{pull.comments}</InlineStat>
          ) : null}
        </div>
      </div>
      {pull.author ? (
        <Avatar handle={pull.author} src={pull.author_avatar} size={24} />
      ) : null}
    </a>
  );
}

export function IssueRow({ issue }: { issue: GhIssue }) {
  const [, short] = issue.repo.split("/");
  const meta = priorityMeta(issue.priority);
  return (
    <a
      href={issue.html_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-line-soft)]"
    >
      <CircleDot
        className="mt-0.5 size-[17px] shrink-0"
        style={{ color: meta.dot }}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
            {issue.title}
          </span>
          {issue.labels.slice(0, 3).map((l) => (
            <LabelChip key={l.name} name={l.name} color={l.color} />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-faint)]">
          <span className="font-[family-name:var(--font-mono)]">
            {short} #{issue.number}
          </span>
          <span>
            opened {relativeTime(issue.created_at)}
            {issue.author ? ` by ${issue.author}` : ""}
          </span>
          <PriorityBadge priority={issue.priority} />
          {issue.milestone ? (
            <InlineStat icon={Milestone}>{issue.milestone}</InlineStat>
          ) : null}
          {issue.comments > 0 ? (
            <InlineStat icon={MessageSquare}>{issue.comments}</InlineStat>
          ) : null}
        </div>
      </div>
      {issue.assignee ? (
        <Avatar handle={issue.assignee} src={issue.assignee_avatar} size={24} />
      ) : null}
    </a>
  );
}
