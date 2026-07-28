"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Custom date+time popover for scheduling posts. Built from styled buttons —
// no native <select>/<input type=datetime-local>, whose OS-drawn popups can't
// be themed and look broken on the dark dashboard.
//
// value: "YYYY-MM-DDTHH:mm" in the user's local time (or "" when unset).

const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Half-hour slots, labeled in the viewer's locale (e.g. "9:00 AM").
const TIME_SLOTS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push({
      value: `${pad(h)}:${pad(m)}`,
      label: new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function SchedulePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const timeList = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const [date, time] = value ? value.split("T") : ["", ""];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [month, setMonth] = useState(() => {
    const base = date ? new Date(`${date}T00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

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

  // On open: move focus into the dialog and scroll the time list (only the
  // list — scrollIntoView would also yank the page) to the selected slot.
  useEffect(() => {
    if (!open) return;
    const day =
      wrap.current?.querySelector<HTMLElement>("[data-selected-day=true]") ??
      wrap.current?.querySelector<HTMLElement>("button[data-day]:not(:disabled)");
    day?.focus();
    if (timeList.current) {
      const target =
        timeList.current.querySelector<HTMLElement>("[data-active=true]") ??
        timeList.current.querySelector<HTMLElement>('[data-slot="09:00"]');
      timeList.current.scrollTop = target
        ? target.offsetTop - timeList.current.clientHeight / 2
        : 0;
    }
  }, [open]);

  // Grid of the displayed month: leading blanks (Monday start) + day cells.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const blanks = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const atCurrentMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  function pickDay(d: Date) {
    onChange(`${dateKey(d)}T${time || "09:00"}`);
  }
  function pickTime(t: string) {
    onChange(`${date || dateKey(new Date())}T${t}`);
  }

  const label =
    value && !isNaN(Date.parse(value))
      ? new Date(value).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="input flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span className={label ? "" : "text-slate-500 dark:text-slate-500"}>
          {label ?? "Pick date & time…"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400 dark:text-slate-500">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date and time"
          className="absolute z-30 mt-2 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg sm:w-auto sm:flex-row"
        >
          {/* Calendar */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                disabled={atCurrentMonth}
                aria-label="Previous month"
                className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                aria-label="Next month"
                className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="h-8 w-10 sm:w-8 text-[11px] font-semibold leading-8 text-slate-500 dark:text-slate-400">
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d === null ? (
                  <span key={`b${i}`} />
                ) : (
                  <button
                    key={dateKey(d)}
                    type="button"
                    data-day
                    data-selected-day={dateKey(d) === date}
                    onClick={() => pickDay(d)}
                    disabled={d < today}
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-md text-sm transition-colors ${
                      dateKey(d) === date
                        ? "bg-emerald-500 font-bold text-slate-950"
                        : d < today
                          ? "text-slate-300 dark:text-slate-600 cursor-default"
                          : `cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 ${
                              dateKey(d) === dateKey(new Date()) ? "font-bold text-emerald-700 dark:text-emerald-400" : ""
                            }`
                    }`}
                  >
                    {d.getDate()}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Time slots */}
          <div
            ref={timeList}
            className="max-h-40 w-full overflow-y-auto border-t border-slate-100 dark:border-slate-800 p-1.5 sm:max-h-72 sm:w-28 sm:border-l sm:border-t-0"
          >
            {TIME_SLOTS.map((t) => (
              <button
                key={t.value}
                type="button"
                data-slot={t.value}
                data-active={t.value === time}
                onClick={() => {
                  pickTime(t.value);
                  if (date) setOpen(false);
                }}
                className={`block w-full rounded-md px-2.5 py-2.5 sm:py-1.5 text-left text-sm transition-colors cursor-pointer ${
                  t.value === time
                    ? "bg-emerald-500 font-bold text-slate-950"
                    : "text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
