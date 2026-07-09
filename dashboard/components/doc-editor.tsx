"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Btn({
  on,
  active,
  children,
  title,
}: {
  on: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        on();
      }}
      className={cn(
        "flex size-8 items-center justify-center rounded-[8px] transition-colors",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-ink)]",
      )}
    >
      {children}
    </button>
  );
}

export function DocEditor({
  id,
  initialTitle,
  initialBody,
  canEdit,
}: {
  id: number;
  initialTitle: string;
  initialBody: string;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (t: string, html: string) => {
    if (!canEdit) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await fetch(`/api/docs/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: t, body: html }),
        });
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 700);
  };

  const editor = useEditor({
    editable: canEdit,
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: initialBody || "",
    onUpdate: ({ editor }) => schedule(title, editor.getHTML()),
  });

  const setLink = (ed: Editor) => {
    const url = window.prompt("Link URL");
    if (url === null) return;
    if (url === "") ed.chain().focus().unsetLink().run();
    else ed.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule(e.target.value, editor?.getHTML() || "");
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
        />
        <span className="ml-3 shrink-0 text-[11.5px] text-[var(--color-faint)]">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>

      {canEdit && editor ? (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-0.5 rounded-[12px] bg-[var(--color-surface)] p-1 ring-1 ring-[var(--color-ring)]">
          <Btn title="Bold" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="size-[15px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Italic" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="size-[15px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Strike" active={editor.isActive("strike")} on={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="size-[15px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Code" active={editor.isActive("code")} on={() => editor.chain().focus().toggleCode().run()}>
            <Code className="size-[15px]" strokeWidth={2.5} />
          </Btn>
          <span className="mx-1 h-5 w-px bg-[var(--color-line)]" />
          <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="size-[16px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-[16px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Bullet list" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="size-[16px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Ordered list" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-[16px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Quote" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-[15px]" strokeWidth={2.5} />
          </Btn>
          <Btn title="Link" active={editor.isActive("link")} on={() => setLink(editor)}>
            <Link2 className="size-[15px]" strokeWidth={2.5} />
          </Btn>
        </div>
      ) : null}

      <EditorContent editor={editor} className="doc-prose" />
    </div>
  );
}
