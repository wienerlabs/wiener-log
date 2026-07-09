import { listAnnouncements } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { postAnnouncement, removeAnnouncement } from "@/lib/announcement-actions";
import { Card, PageHeader, SectionHeader, EmptyState } from "@/components/ui";
import { relativeTime } from "@/lib/utils";
import { Pin, Trash2, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const [items, admin] = await Promise.all([listAnnouncements(), isAdmin()]);

  return (
    <div className="rise mx-auto max-w-[760px]">
      <PageHeader
        title="Announcements"
        subtitle="Company-wide posts. Pinned ones surface on the home page."
      />

      {admin ? (
        <div className="mb-8">
          <SectionHeader title="New announcement" />
          <Card className="p-5">
            <form action={postAnnouncement} className="flex flex-col gap-3">
              <input
                name="title"
                required
                maxLength={200}
                placeholder="Title"
                className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[14px] font-medium text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
              />
              <textarea
                name="body"
                rows={3}
                placeholder="Details (optional)"
                className="w-full resize-none rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    name="pinned"
                    className="size-[15px] accent-[var(--color-accent)]"
                  />
                  Pin to home
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-btn)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99]"
                >
                  <Megaphone className="size-4" strokeWidth={2} /> Post
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState>No announcements yet.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned ? (
                    <Pin className="size-[15px] text-[var(--color-accent)]" strokeWidth={2} />
                  ) : null}
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                    {a.title}
                  </h3>
                </div>
                {admin ? (
                  <form action={removeAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      title="Delete"
                      className="flex size-7 items-center justify-center rounded-[8px] text-[var(--color-faint)] transition-colors hover:text-[var(--color-danger)]"
                    >
                      <Trash2 className="size-[14px]" strokeWidth={2} />
                    </button>
                  </form>
                ) : null}
              </div>
              {a.body ? (
                <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-[var(--color-ink-soft)]">
                  {a.body}
                </p>
              ) : null}
              <div className="mt-3 text-[11.5px] text-[var(--color-faint)]">
                @{a.author} · {relativeTime(a.created_at)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
