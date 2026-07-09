"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Message } from "@/lib/db";
import { Avatar } from "@/components/ui";
import { MentionText } from "@/components/mention-text";
import { EmojiPicker } from "@/components/emoji-picker";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SendHorizontal, Smile, Search, Sparkles, SmilePlus, X } from "lucide-react";

export function ChatView({
  initialMessages,
  me,
  members,
  projects,
}: {
  initialMessages: Message[];
  me: string;
  members: string[];
  projects: string[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[] | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactFor, setReactFor] = useState<number | null>(null);
  const [ac, setAc] = useState<{
    type: "@" | "#";
    items: string[];
    index: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const live = results === null;
  const shown = results ?? messages;

  const toBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    toBottom();
  }, []);

  useEffect(() => {
    if (!live) return;
    const poll = async () => {
      try {
        const r = await fetch("/api/chat");
        if (!r.ok) return;
        const d = (await r.json()) as { messages: Message[] };
        setMessages(d.messages);
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !live) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    if (near) toBottom();
  }, [messages, live]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chat?q=${encodeURIComponent(q)}`);
        if (r.ok) setResults(((await r.json()) as { messages: Message[] }).messages);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = v.slice(0, caret).match(/(?:^|\s)([@#])([a-zA-Z0-9._-]*)$/);
    if (m) {
      const type = m[1] as "@" | "#";
      const q = m[2].toLowerCase();
      const src = type === "@" ? members : projects;
      const items = src.filter((x) => x.toLowerCase().includes(q)).slice(0, 6);
      setAc(items.length ? { type, items, index: 0 } : null);
    } else {
      setAc(null);
    }
  };

  const pickAc = (val: string) => {
    const caret = taRef.current?.selectionStart ?? text.length;
    const before = text
      .slice(0, caret)
      .replace(/([@#])([a-zA-Z0-9._-]*)$/, (_x, sym) => `${sym}${val} `);
    setText(before + text.slice(caret));
    setAc(null);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    setEmojiOpen(false);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    setAc(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const d = (await r.json()) as { message?: Message };
        if (d.message)
          setMessages((p) =>
            p.some((m) => m.id === d.message!.id) ? p : [...p, d.message!],
          );
        setTimeout(toBottom, 0);
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const react = async (id: number, emoji: string) => {
    setReactFor(null);
    setMessages((p) =>
      p.map((m) => {
        if (m.id !== id) return m;
        const rx = [...m.reactions];
        const i = rx.findIndex((r) => r.emoji === emoji);
        if (i >= 0) {
          const r = rx[i];
          if (r.mine) {
            if (r.count <= 1) rx.splice(i, 1);
            else rx[i] = { ...r, count: r.count - 1, mine: false };
          } else {
            rx[i] = { ...r, count: r.count + 1, mine: true };
          }
        } else {
          rx.push({ emoji, count: 1, mine: true });
        }
        return { ...m, reactions: rx };
      }),
    );
    try {
      await fetch("/api/chat/react", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: id, emoji }),
      });
    } catch {
      /* ignore */
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (ac) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAc((a) => (a ? { ...a, index: Math.min(a.index + 1, a.items.length - 1) } : a));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAc((a) => (a ? { ...a, index: Math.max(a.index - 1, 0) } : a));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickAc(ac.items[ac.index]);
        return;
      }
      if (e.key === "Escape") {
        setAc(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-[calc(100vh-210px)] min-h-[440px] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] ring-1 ring-[var(--color-ring)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
        <Search className="size-[15px] text-[var(--color-faint)]" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages"
          className="flex-1 bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
        />
        {results ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            {results.length} found · clear <X className="size-[13px]" />
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {shown.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-faint)]">
            {results ? "No messages match." : "No messages yet. Say hello, or ask @wiener something."}
          </div>
        ) : (
          shown.map((m) => {
            if (m.kind === "system") {
              return (
                <div key={m.id} className="py-1 text-center">
                  <span className="rounded-full bg-[var(--color-line-soft)] px-3 py-1 text-[12px] text-[var(--color-muted)]">
                    <MentionText text={m.body} />
                  </span>
                </div>
              );
            }
            const bot = m.kind === "bot";
            return (
              <div key={m.id} className="group flex items-start gap-2.5">
                {bot ? (
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    <Sparkles className="size-[16px]" strokeWidth={2} />
                  </span>
                ) : (
                  <Link href={`/members/${m.author}`}>
                    <Avatar handle={m.author} src={m.avatar_url} size={30} />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-[13px] font-semibold",
                        bot
                          ? "text-[var(--color-accent)]"
                          : m.author === me
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-ink)]",
                      )}
                    >
                      {bot ? "WienerLog" : m.author}
                    </span>
                    <span className="text-[11px] text-[var(--color-faint)]">
                      {relativeTime(m.created_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-[var(--color-ink-soft)]">
                    <MentionText text={m.body} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => live && react(m.id, r.emoji)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] ring-1 transition-colors",
                          r.mine
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[var(--color-accent)]/30"
                            : "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)] ring-transparent hover:ring-[var(--color-ring)]",
                        )}
                      >
                        <span>{r.emoji}</span>
                        <span className="tabular-nums">{r.count}</span>
                      </button>
                    ))}
                    {live ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setReactFor(reactFor === m.id ? null : m.id)}
                          className="inline-flex size-[22px] items-center justify-center rounded-full text-[var(--color-faint)] opacity-0 transition-all hover:bg-[var(--color-line-soft)] hover:text-[var(--color-ink)] group-hover:opacity-100"
                        >
                          <SmilePlus className="size-[14px]" strokeWidth={2} />
                        </button>
                        {reactFor === m.id ? (
                          <div className="absolute bottom-7 left-0 z-30">
                            <EmojiPicker onPick={(e) => react(m.id, e)} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="relative border-t border-[var(--color-line)] p-3">
        {ac ? (
          <div className="absolute bottom-[calc(100%-6px)] left-3 z-30 w-[240px] overflow-hidden rounded-[12px] bg-[var(--color-surface)] ring-1 ring-[var(--color-ring)] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)]">
            {ac.items.map((it, i) => (
              <button
                key={it}
                type="button"
                onMouseEnter={() => setAc((a) => (a ? { ...a, index: i } : a))}
                onClick={() => pickAc(it)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]",
                  i === ac.index ? "bg-[var(--color-line-soft)]" : "",
                )}
              >
                <span className="text-[var(--color-faint)]">{ac.type}</span>
                {it}
              </button>
            ))}
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="absolute bottom-[calc(100%-6px)] right-3 z-30">
            <EmojiPicker onPick={insertEmoji} />
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line-soft)] hover:text-[var(--color-ink)]"
          >
            <Smile className="size-[19px]" strokeWidth={2} />
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKey}
            rows={1}
            placeholder="Message the team… @mention, #project, /task, or ask @wiener"
            className="max-h-[120px] min-h-[42px] w-full resize-none rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-btn)] text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            <SendHorizontal className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
