"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI = [
  "🚀","🔥","✨","💡","🎯","📈","🎉","👏","💪","🙌","❤️","😍","😀","😎","🤩","🥳",
  "📸","🎵","▶️","💼","👥","🧵","📌","🌐","📣","🗓️","⏰","✅","⭐","🏆","💰","🛍️",
  "🇸🇬","🌏","☕","🍕","🏖️","⚡","🔗","📊","🧠","🤖","👩‍💻","👨‍💻","📚","🎓","🎬","🎨",
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label="Insert emoji"
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-lg grid grid-cols-8 gap-0.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="h-7 w-7 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
