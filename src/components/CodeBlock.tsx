"use client";

import { useState } from "react";

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          {title && <span className="ml-3 text-xs text-slate-400">{title}</span>}
        </div>
        <button
          onClick={copy}
          className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-[13px] leading-relaxed text-slate-200 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
