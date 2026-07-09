import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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
        "rounded-[18px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.12)]",
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
  claude_code: "bg-[#f3ecfb] text-[#7b3fbf]",
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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--color-line)] bg-white/40 px-6 py-16 text-center text-[13.5px] text-[var(--color-faint)]">
      {children}
    </div>
  );
}
