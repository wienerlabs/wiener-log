import Link from "next/link";

type Part =
  | { t: "text"; v: string }
  | { t: "mention"; v: string }
  | { t: "project"; v: string }
  | { t: "url"; v: string };

export function MentionText({ text }: { text: string }) {
  const parts: Part[] = [];
  const re = /(@[a-zA-Z0-9-]+|#[a-zA-Z0-9._-]+|https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: "text", v: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("@")) parts.push({ t: "mention", v: tok });
    else if (tok.startsWith("#")) parts.push({ t: "project", v: tok });
    else parts.push({ t: "url", v: tok });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });

  return (
    <>
      {parts.map((p, i) => {
        if (p.t === "mention")
          return (
            <Link
              key={i}
              href={`/members/${p.v.slice(1)}`}
              className="font-medium text-[var(--color-accent)] hover:opacity-70"
            >
              {p.v}
            </Link>
          );
        if (p.t === "project")
          return (
            <Link
              key={i}
              href={`/projects/${p.v.slice(1)}`}
              className="font-medium text-[var(--color-accent)] hover:opacity-70"
            >
              {p.v}
            </Link>
          );
        if (p.t === "url")
          return (
            <a
              key={i}
              href={p.v}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-70"
            >
              {p.v}
            </a>
          );
        return <span key={i}>{p.v}</span>;
      })}
    </>
  );
}
