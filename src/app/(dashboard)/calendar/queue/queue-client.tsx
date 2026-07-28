"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/Select";

interface QueueConfig {
  timezone: string;
  activeDays: string[];
  slotTimes: string[];
  maxPerSlot: number;
}

interface QueueSlot {
  time: string;
  used: number;
  capacity: number;
  available: boolean;
  posts: { id: string; title: string }[];
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIMEZONES = [
  ["America/New_York", "Eastern Time (ET)"],
  ["America/Chicago", "Central Time (CT)"],
  ["America/Los_Angeles", "Pacific Time (PT)"],
  ["Europe/London", "London (GMT/BST)"],
  ["Europe/Paris", "Central Europe (CET)"],
  ["Asia/Singapore", "Singapore (SGT)"],
  ["Asia/Tokyo", "Tokyo (JST)"],
  ["Australia/Sydney", "Sydney (AEST)"],
  ["UTC", "UTC"],
];

// The wall-clock time HH:MM in `tz` (today) as it reads on the browser's own
// clock. When the selected timezone IS the browser's, this returns HH:MM
// unchanged (nothing to convert).
function localBadge(time: string, tz: string): string {
  try {
    const [hh, mm] = time.split(":").map(Number);
    const now = new Date();
    // tz's current calendar date + its UTC offset right now.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const tzOffsetMin =
      (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute")) - now.getTime()) / 60000;
    // UTC instant of HH:MM on tz's today, then rendered in the browser's zone.
    const utcMs = Date.UTC(get("year"), get("month") - 1, get("day"), hh, mm) - tzOffsetMin * 60000;
    return new Date(utcMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return time;
  }
}

const STEPS = [
  { n: 1, title: "Customize Your Schedule", body: "The queue uses default times (9am, 12pm, 5pm ET). Customize them here if you want different times." },
  { n: 2, title: "Add to Queue", body: 'When creating content, use "Add to Queue" instead of scheduling a specific time.' },
  { n: 3, title: "Auto-Schedule", body: "Your post is automatically scheduled to your next available slot." },
];

export function QueueClient({
  profiles,
  initial,
}: {
  profiles: { id: string; name: string }[];
  initial: { profileId: string; config: QueueConfig; slots: QueueSlot[] } | null;
}) {
  const [profileId, setProfileId] = useState(initial?.profileId ?? "");
  const [config, setConfig] = useState<QueueConfig | null>(initial?.config ?? null);
  const [slots, setSlots] = useState<QueueSlot[]>(initial?.slots ?? []);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const gmtOffset = -new Date().getTimezoneOffset() / 60;

  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/internal/queue?profileId=${profileId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setConfig(d.config);
          setSlots(d.slots);
        }
      });
  }, [profileId]);

  // Live preview: recompute (debounced) whenever the unsaved config changes, so
  // toggling active days / editing times updates the slot list immediately —
  // without persisting each edit. Occupancy comes from the same server logic.
  useEffect(() => {
    if (!profileId || !config) return;
    const t = setTimeout(() => {
      fetch("/api/internal/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId, ...config }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setSlots(d.slots);
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [profileId, config]);

  async function save(refreshOnly = false) {
    if (!config) return;
    setBusy(true);
    const res = await fetch("/api/internal/queue", {
      method: refreshOnly ? "GET" : "PUT",
      ...(refreshOnly
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ profileId, ...config }),
          }),
      ...(refreshOnly ? {} : {}),
    });
    const data = refreshOnly
      ? await (await fetch(`/api/internal/queue?profileId=${profileId}`)).json()
      : await res.json();
    setBusy(false);
    if (data.success) {
      setConfig(data.config);
      setSlots(data.slots);
      if (!refreshOnly) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
  }

  if (!config) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Create a profile in User Management first to configure its queue.
      </p>
    );
  }

  function setTime(i: number, part: "hh" | "mm", value: string) {
    if (!config) return;
    const times = [...config.slotTimes];
    const [hh, mm] = times[i].split(":");
    times[i] = part === "hh" ? `${value}:${mm}` : `${hh}:${value}`;
    setConfig({ ...config, slotTimes: times });
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Queue Settings</h1>
      </div>
      <p className="mt-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">
        Customize your posting schedule. The queue is always active with default times (9am, 12pm,
        5pm ET). Posts added to the queue will automatically be scheduled to your next available slot.
      </p>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Active profile</p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuring queue for</h2>
          <p className="text-sm text-slate-400">Each profile has its own queue settings.</p>
        </div>
        <Select
          className="w-56"
          ariaLabel="Select profile"
          value={profileId}
          onChange={setProfileId}
          options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <section className="card p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuration</h2>

          <span className="label mt-4">Timezone</span>
          <Select
            ariaLabel="Timezone"
            value={config.timezone}
            onChange={(v) => setConfig({ ...config, timezone: v })}
            options={TIMEZONES.map(([v, label]) => ({ value: v, label }))}
          />

          <span className="label mt-5">Active Days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const on = config.activeDays.includes(d);
              return (
                <button
                  key={d}
                  onClick={() =>
                    setConfig({
                      ...config,
                      activeDays: on ? config.activeDays.filter((x) => x !== d) : [...config.activeDays, d],
                    })
                  }
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    on ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <label className="label mt-5" htmlFor="mps">Max posts per slot</label>
          <p className="-mt-1 mb-1 text-xs text-slate-400">How many posts can be scheduled per time slot.</p>
          <input
            id="mps"
            type="number"
            min={1}
            max={10}
            className="input"
            value={config.maxPerSlot}
            onChange={(e) => setConfig({ ...config, maxPerSlot: Math.max(1, +e.target.value) })}
          />

          <div className="mt-5 flex items-center justify-between">
            <span className="label mb-0">Posting Times</span>
            <button
              onClick={() => setConfig({ ...config, slotTimes: [...config.slotTimes, "15:00"] })}
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              + Add slot
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {config.slotTimes.map((t, i) => {
              const [hh, mm] = t.split(":");
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                  <Select
                    className="w-20"
                    ariaLabel="Hour"
                    value={hh}
                    onChange={(v) => setTime(i, "hh", v)}
                    options={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => ({ value: h, label: h }))}
                  />
                  <span className="font-bold text-slate-400">:</span>
                  <Select
                    className="w-20"
                    ariaLabel="Minute"
                    value={mm}
                    onChange={(v) => setTime(i, "mm", v)}
                    options={["00", "15", "30", "45"].map((m) => ({ value: m, label: m }))}
                  />
                  {config.timezone !== browserTz && (
                    <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
                      = {localBadge(t, config.timezone)} your time
                    </span>
                  )}
                  <button
                    onClick={() => setConfig({ ...config, slotTimes: config.slotTimes.filter((_, j) => j !== i) })}
                    aria-label="Remove slot"
                    className="ml-auto text-slate-300 hover:text-red-500 cursor-pointer"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Your browser timezone: <strong>GMT{gmtOffset >= 0 ? "+" : ""}{gmtOffset}</strong> ({browserTz}). Posts will be
            scheduled to these times in your selected timezone.
          </p>

          <div className="mt-5 flex justify-end">
            <button onClick={() => save()} disabled={busy} className="btn-primary">
              {saved ? "Saved ✓" : busy ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </section>

        {/* Queue preview */}
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Queue Preview</h2>
            <button onClick={() => save(true)} className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
              Refresh
            </button>
          </div>
          <p className="mt-3 rounded-lg border-l-4 border-sky-400 bg-sky-50 dark:bg-sky-950/50 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
            Showing times in your local timezone (<strong>GMT{gmtOffset >= 0 ? "+" : ""}{gmtOffset}</strong>)
          </p>
          <ul className="mt-3 space-y-2">
            {slots.map((slot) => {
              const d = new Date(slot.time);
              return (
                <li
                  key={slot.time}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${
                    slot.available
                      ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    {config.timezone !== browserTz && (
                      <span className="block text-xs text-slate-400">
                        {d.toLocaleString("en-US", { timeZone: config.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} ({config.timezone.split("/")[1]?.replace("_", " ")})
                      </span>
                    )}
                    {slot.posts.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {slot.posts.map((p) => p.title).join(", ")}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      slot.available
                        ? "border-green-300 dark:border-green-800 text-green-700 dark:text-green-400"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {slot.available
                      ? slot.capacity > 1
                        ? `${slot.capacity - slot.used} of ${slot.capacity} free`
                        : "Available"
                      : slot.capacity > 1
                        ? "Full"
                        : "Taken"}
                  </span>
                </li>
              );
            })}
            {slots.length === 0 && (
              <li className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-400">
                No upcoming slots — add active days and posting times above.
              </li>
            )}
          </ul>
          {(() => {
            const next = slots.find((s) => s.available);
            if (!next) {
              return slots.length > 0 ? (
                <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Queue full</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Every upcoming slot is taken. New posts queue after the last one shown, or add more posting times.
                  </p>
                </div>
              ) : null;
            }
            const nd = new Date(next.time);
            return (
              <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Next available slot</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                  {nd.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })},{" "}
                  {nd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                </p>
                <p className="text-xs text-slate-400">Your local time — where the next queued post lands</p>
              </div>
            );
          })()}
        </section>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">How the Queue Works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {s.n}
              </span>
              <h3 className="mt-3 font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
