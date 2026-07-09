"use client";

const EMOJIS = [
  "👍", "❤️", "🎉", "🚀", "🔥", "👀", "✅", "😄",
  "😂", "🙌", "👏", "💯", "🤔", "😅", "🙏", "💪",
  "👌", "🥳", "😎", "🤝", "⚡", "✨", "💡", "🐛",
  "📈", "🧠", "☕", "🫡", "😴", "🤯", "❓", "🎯",
];

export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5 rounded-[12px] bg-[var(--color-surface)] p-2 ring-1 ring-[var(--color-ring)] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)]">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="rounded-[6px] p-1 text-[18px] leading-none transition-colors hover:bg-[var(--color-line-soft)]"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
