"use client";

import { useEffect, useState } from "react";

interface QueueConfig {
  timezone: string;
  activeDays: string[];
  slotTimes: string[];
  maxPerSlot: number;
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

function localBadge(time: string, tz: string): string {
  // Convert an HH:MM in tz to the browser's local wall time (today's offset)
  try {
    const [hh, mm] = time.split(":").map(Number);
    const now = new Date();
    const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    // interpret probe as tz time: find the UTC instant whose tz-rendering equals probe
    const target = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
    const inTz = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
    const utc = new Date(probe.getTime() + (target.getTime() - inTz.getTime()));
    return utc.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
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
  initial: { profileId: string; config: QueueConfig; slots: string[] } | null;
}) {
  const [profileId, setProfileId] = useState(initial?.profileId ?? "");
  const [config, setConfig] = useState<QueueConfig | null>(initial?.config ?? null);
  const [slots, setSlots] = useState<string[]>(initial?.slots ?? []);
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
        <select className="input w-56" value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label="Select profile">
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <section className="card p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuration</h2>

          <label className="label mt-4" htmlFor="tz">Timezone</label>
          <select id="tz" className="input" value={config.timezone} onChange={(e) => setConfig({ ...config, timezone: e.target.value })}>
            {TIMEZONES.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>

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
                  <select value={hh} onChange={(e) => setTime(i, "hh", e.target.value)} className="input w-20" aria-label="Hour">
                    {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="font-bold text-slate-400">:</span>
                  <select value={mm} onChange={(e) => setTime(i, "mm", e.target.value)} className="input w-20" aria-label="Minute">
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
                    = {localBadge(t, config.timezone)} local
                  </span>
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
            {slots.map((iso) => {
              const d = new Date(iso);
              return (
                <li key={iso} className="flex items-center justify-between rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30 px-4 py-2.5">
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {d.toLocaleString("en-US", { timeZone: config.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} ({config.timezone.split("/")[1]?.replace("_", " ")})
                    </span>
                  </span>
                  <span className="rounded-full border border-green-300 dark:border-green-800 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    Available
                  </span>
                </li>
              );
            })}
          </ul>
          {slots[0] && (
            <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Next available slot</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {new Date(slots[0]).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })},{" "}
                {new Date(slots[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
              </p>
              <p className="text-xs text-slate-400">Your local time</p>
            </div>
          )}
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
