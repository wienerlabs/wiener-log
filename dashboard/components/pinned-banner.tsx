import { getLatestPinned } from "@/lib/db";
import Link from "next/link";
import { Megaphone } from "lucide-react";

export async function PinnedBanner() {
  const a = await getLatestPinned();
  if (!a) return null;
  return (
    <Link
      href="/announcements"
      className="mb-6 flex items-start gap-3 rounded-[14px] bg-[var(--color-accent-soft)] px-4 py-3 ring-1 ring-[var(--color-accent)]/20 transition-transform hover:-translate-y-0.5"
    >
      <Megaphone
        className="mt-0.5 size-[17px] shrink-0 text-[var(--color-accent)]"
        strokeWidth={2}
      />
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
          {a.title}
        </div>
        {a.body ? (
          <div className="line-clamp-1 text-[12.5px] text-[var(--color-muted)]">
            {a.body}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
