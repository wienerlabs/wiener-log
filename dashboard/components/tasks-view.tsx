"use client";

import { useState } from "react";
import type { TaskRow } from "@/lib/db";
import { Avatar, Mono, EmptyState } from "@/components/ui";
import { Segmented } from "@/components/controls";
import { shortId, relativeTime, cn } from "@/lib/utils";
import { LayoutGrid, ListChecks, GripVertical, Check } from "lucide-react";

const COLUMNS: { status: string; label: string; dot: string }[] = [
  { status: "proposed", label: "Proposed", dot: "#a1a1aa" },
  { status: "acked", label: "Acked", dot: "#1a7f45" },
  { status: "in_progress", label: "In progress", dot: "#0060b0" },
  { status: "done", label: "Done", dot: "#1a7f45" },
];

export function TasksView({ tasks: initial }: { tasks: TaskRow[] }) {
  const [tasks, setTasks] = useState<TaskRow[]>(initial);
  const [view, setView] = useState("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const move = (id: string, status: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: status as TaskRow["status"] } : t)),
    );
    fetch("/api/tasks/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  };

  const Card = ({ t }: { t: TaskRow }) => (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        setDragId(t.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setOverCol(null);
      }}
      className={cn(
        "group cursor-grab rounded-[12px] bg-[var(--color-surface)] p-3 ring-1 ring-[var(--color-ring)] transition-all active:cursor-grabbing",
        dragId === t.id ? "opacity-40" : "hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-[14px] shrink-0 text-[var(--color-faint)] opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium leading-[1.35] text-[var(--color-ink)]">
            {t.title}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--color-faint)]">
            <span className="inline-flex items-center gap-1">
              <Avatar handle={t.workspace_slug} size={16} />
              {t.workspace_slug}
            </span>
            {t.repo ? (
              <span className="font-[family-name:var(--font-mono)] truncate">
                {t.repo.split("/").pop()}
              </span>
            ) : null}
            {t.github_url ? (
              <a
                href={t.github_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-[var(--color-accent)] hover:opacity-70"
              >
                GitHub
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { key: "board", label: "Board" },
            { key: "list", label: "To-do list" },
          ]}
        />
      </div>

      {view === "board" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.status);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) move(id, col.status);
                  setOverCol(null);
                  setDragId(null);
                }}
                className={cn(
                  "flex min-h-[200px] flex-col gap-2.5 rounded-[16px] p-3 transition-colors",
                  overCol === col.status
                    ? "bg-[var(--color-accent-soft)] ring-2 ring-[var(--color-accent)]/40"
                    : "bg-[var(--color-line-soft)]",
                )}
              >
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-ink-soft)]">
                    <span className="inline-block size-[8px] rounded-full" style={{ backgroundColor: col.dot }} />
                    {col.label}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-[var(--color-faint)]">
                    {colTasks.length}
                  </span>
                </div>
                {colTasks.map((t) => (
                  <Card key={t.id} t={t} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.filter((t) => t.status !== "rejected").length === 0 ? (
            <EmptyState>No tasks yet.</EmptyState>
          ) : (
            tasks
              .filter((t) => t.status !== "rejected")
              .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0))
              .map((t) => {
                const done = t.status === "done";
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-[12px] bg-[var(--color-surface)] px-4 py-3 ring-1 ring-[var(--color-ring)]"
                  >
                    <button
                      type="button"
                      onClick={() => move(t.id, done ? "acked" : "done")}
                      className={cn(
                        "flex size-[20px] shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
                        done
                          ? "bg-[var(--color-ok)] ring-[var(--color-ok)] text-white"
                          : "ring-[var(--color-line)] hover:ring-[var(--color-accent)]",
                      )}
                    >
                      {done ? <Check className="size-[13px]" strokeWidth={3} /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[13.5px] font-medium",
                          done
                            ? "text-[var(--color-faint)] line-through"
                            : "text-[var(--color-ink)]",
                        )}
                      >
                        {t.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[var(--color-faint)]">
                        <span>@{t.workspace_slug}</span>
                        <Mono>{shortId(t.id)}</Mono>
                        <span>{relativeTime(t.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
