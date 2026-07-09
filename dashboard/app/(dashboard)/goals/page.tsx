import { listObjectives } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import {
  createObjectiveAction,
  addKeyResultAction,
  deleteObjectiveAction,
} from "@/lib/okr-actions";
import { Card, PageHeader, SectionHeader, EmptyState } from "@/components/ui";
import { ProgressSlider } from "@/components/progress-slider";
import { Target, Trash2, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [objectives, admin] = await Promise.all([listObjectives(), isAdmin()]);

  return (
    <div className="rise">
      <PageHeader
        title="Goals"
        subtitle="Objectives and key results. Progress is visible to the whole team."
      />

      {admin ? (
        <div className="mb-8">
          <SectionHeader title="New objective" />
          <Card className="p-5">
            <form
              action={createObjectiveAction}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                name="title"
                required
                placeholder="Objective"
                className="flex-1 rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
              />
              <input
                name="owner"
                placeholder="Owner"
                className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] sm:w-[130px]"
              />
              <input
                name="period"
                placeholder="Period"
                className="w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] sm:w-[110px]"
              />
              <button
                type="submit"
                className="rounded-[11px] bg-[var(--color-btn)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99]"
              >
                Create
              </button>
            </form>
          </Card>
        </div>
      ) : null}

      {objectives.length === 0 ? (
        <EmptyState>No objectives yet.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {objectives.map((o) => {
            const overall =
              o.key_results.length > 0
                ? Math.round(
                    o.key_results.reduce((a, k) => a + k.progress, 0) /
                      o.key_results.length,
                  )
                : 0;
            return (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Target
                      className="mt-0.5 size-[18px] shrink-0 text-[var(--color-accent)]"
                      strokeWidth={2}
                    />
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                        {o.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--color-faint)]">
                        {o.owner ? <span>@{o.owner}</span> : null}
                        {o.period ? (
                          <span className="rounded-full bg-[var(--color-line-soft)] px-2 py-0.5">
                            {o.period}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[18px] font-semibold tabular-nums text-[var(--color-ink)]">
                      {overall}%
                    </span>
                    {admin ? (
                      <form action={deleteObjectiveAction}>
                        <input type="hidden" name="id" value={o.id} />
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
                </div>

                {o.key_results.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-4">
                    {o.key_results.map((k) => (
                      <ProgressSlider
                        key={k.id}
                        id={k.id}
                        initial={k.progress}
                        title={k.title}
                        canEdit={admin}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] text-[var(--color-faint)]">
                    No key results yet.
                  </p>
                )}

                {admin ? (
                  <form
                    action={addKeyResultAction}
                    className="mt-4 flex gap-2 border-t border-[var(--color-line-soft)] pt-4"
                  >
                    <input type="hidden" name="objectiveId" value={o.id} />
                    <input
                      name="title"
                      required
                      placeholder="Add a key result"
                      className="flex-1 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-1.5 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-[10px] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
                    >
                      <Plus className="size-[14px]" strokeWidth={2.5} /> Add
                    </button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
