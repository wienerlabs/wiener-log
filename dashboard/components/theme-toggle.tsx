"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Mode | null;
    setMode(stored ?? "system");
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  const choose = (m: Mode) => {
    setMode(m);
    if (m === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", m);
    apply(m);
  };

  const opts: { key: Mode; Icon: typeof Sun; label: string }[] = [
    { key: "light", Icon: Sun, label: "Light" },
    { key: "system", Icon: Monitor, label: "System" },
    { key: "dark", Icon: Moon, label: "Dark" },
  ];

  return (
    <div className="flex gap-1 rounded-[10px] bg-[var(--color-line-soft)] p-1">
      {opts.map(({ key, Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => choose(key)}
          title={label}
          aria-label={label}
          aria-pressed={mode === key}
          className={cn(
            "flex flex-1 items-center justify-center rounded-[7px] py-1.5 transition-all",
            mode === key
              ? "bg-[var(--color-raised)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "text-[var(--color-faint)] hover:text-[var(--color-ink-soft)]",
          )}
        >
          <Icon className="size-[15px]" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
