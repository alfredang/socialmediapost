"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Select } from "@/components/Select";
import { PLATFORM_MAP } from "@/lib/platforms";

interface CalEvent {
  id: string;
  title: string;
  date: string;
  status: string;
  profile: string;
  platforms: string[];
}

type View = "month" | "week" | "day";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  published: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  partial: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  failed: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
};

export function CalendarClient({
  events,
  profiles,
  weekStart,
}: {
  events: CalEvent[];
  profiles: string[];
  weekStart: string;
}) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [platformFilter, setPlatformFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");

  const filtered = events.filter(
    (e) =>
      (platformFilter === "all" || e.platforms.includes(platformFilter)) &&
      (profileFilter === "all" || e.profile === profileFilter)
  );

  const weekStartIdx = weekStart === "sunday" ? 0 : 1;

  const days = useMemo(() => {
    const list: Date[] = [];
    const d = new Date(cursor);
    if (view === "day") {
      list.push(new Date(d));
    } else if (view === "week") {
      const day = d.getDay();
      const diff = (day - weekStartIdx + 7) % 7;
      d.setDate(d.getDate() - diff);
      for (let i = 0; i < 7; i++) {
        list.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
    } else {
      d.setDate(1);
      const day = d.getDay();
      const diff = (day - weekStartIdx + 7) % 7;
      d.setDate(d.getDate() - diff);
      for (let i = 0; i < 42; i++) {
        list.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
    }
    return list;
  }, [cursor, view, weekStartIdx]);

  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  }

  function eventsOn(day: Date) {
    return filtered.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
    });
  }

  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  const rangeLabel =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "day"
        ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
        : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const allPlatforms = [...new Set(events.flatMap((e) => e.platforms))];

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Calendar</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Plan, schedule, and review your posts across every platform.
      </p>

      <div className="card mt-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} aria-label="Previous" className="btn-secondary px-2.5 py-1.5">‹</button>
            <button onClick={() => setCursor(new Date())} className="btn-secondary py-1.5">Today</button>
            <button onClick={() => shift(1)} aria-label="Next" className="btn-secondary px-2.5 py-1.5">›</button>
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">{rangeLabel}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              {(["month", "week", "day"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors cursor-pointer ${
                    view === v ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Select
              className="w-40"
              ariaLabel="Filter platforms"
              value={platformFilter}
              onChange={setPlatformFilter}
              options={[{ value: "all", label: "Platforms" }, ...allPlatforms.map((p) => ({ value: p, label: PLATFORM_MAP[p]?.name ?? p }))]}
            />
            <Select
              className="w-40"
              ariaLabel="Filter profiles"
              value={profileFilter}
              onChange={setProfileFilter}
              options={[{ value: "all", label: "All Profiles" }, ...profiles.map((p) => ({ value: p, label: p }))]}
            />
            <Link href="/upload" className="btn-primary py-1.5">+ Create</Link>
          </div>
        </div>

        {view === "month" ? (
          <div className="mt-4 grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
            {days.slice(0, 7).map((d) => (
              <div key={`h-${d.toISOString()}`} className="bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
            ))}
            {days.map((d) => {
              const evts = eventsOn(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              return (
                <div key={d.toISOString()} className={`min-h-24 bg-white dark:bg-slate-950 p-1.5 ${inMonth ? "" : "opacity-40"} ${isToday(d) ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                  <span className={`text-xs font-medium ${isToday(d) ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-400"}`}>
                    {d.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {evts.slice(0, 3).map((e) => (
                      <div key={e.id} className={`truncate rounded border px-1 py-0.5 text-[10px] font-medium ${STATUS_COLORS[e.status] ?? STATUS_COLORS.scheduled}`} title={e.title}>
                        {e.title}
                      </div>
                    ))}
                    {evts.length > 3 && <p className="text-[10px] text-slate-400">+{evts.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 grid gap-px rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
            {days.map((d) => (
              <div key={`h-${d.toISOString()}`} className={`bg-slate-50 dark:bg-slate-900 px-2 py-2 text-center text-xs font-semibold ${isToday(d) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                {d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })}
              </div>
            ))}
            {days.map((d) => {
              const evts = eventsOn(d).sort((a, b) => a.date.localeCompare(b.date));
              return (
                <div key={d.toISOString()} className={`min-h-72 bg-white dark:bg-slate-950 p-2 ${isToday(d) ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                  <div className="space-y-1.5">
                    {evts.length === 0 && <p className="pt-8 text-center text-[10px] text-slate-300 dark:text-slate-600">—</p>}
                    {evts.map((e) => (
                      <div key={e.id} className={`rounded-lg border p-1.5 ${STATUS_COLORS[e.status] ?? STATUS_COLORS.scheduled}`}>
                        <p className="text-[10px] font-semibold">{new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="truncate text-[11px] font-medium" title={e.title}>{e.title}</p>
                        <div className="mt-1 flex gap-0.5">
                          {e.platforms.slice(0, 5).map((p) => (
                            <PlatformIcon key={p} platform={p} size={10} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          {Object.entries({ scheduled: "Scheduled", published: "Published", partial: "Partial", failed: "Failed" }).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full border ${STATUS_COLORS[k]}`} /> {label}
            </span>
          ))}
          <Link href="/calendar/queue" className="ml-auto font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
            Queue Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
