"use client";

import { useEffect, useRef, useState } from "react";

// Themed dropdown to replace native <select>, whose OS-drawn option list can't
// be styled and renders as a bright white box on the dark dashboard. Matches
// the SchedulePicker popover: dark surface, emerald-selected rows.

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  className,
  triggerClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  // Override the trigger's look (e.g. a compact, transparent inline control).
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // On open, scroll the selected row into view (long lists like timezones).
  useEffect(() => {
    if (!open || !list.current) return;
    const active = list.current.querySelector<HTMLElement>("[data-active=true]");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={
          triggerClassName ?? "input flex w-full items-center justify-between gap-2 text-left cursor-pointer"
        }
      >
        <span className={current ? "truncate" : "truncate text-slate-500 dark:text-slate-500"}>
          {current?.label ?? placeholder ?? "Select…"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={list}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-2 max-h-72 w-max min-w-full max-w-[min(90vw,22rem)] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              data-active={o.value === value}
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`block w-full truncate rounded-md px-2.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                o.value === value
                  ? "bg-emerald-500 font-bold text-slate-950"
                  : "text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
