"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORM_MAP } from "@/lib/platforms";

interface Snap {
  profileId: string;
  platform: string;
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}
interface ProfileRow {
  id: string;
  name: string;
  accounts: { id: string; platform: string; handle: string; status: string }[];
}

type Metric = "followers" | "reach" | "impressions";
const METRICS: { key: Metric; label: string; icon: string }[] = [
  { key: "followers", label: "Followers", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "reach", label: "Reach", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { key: "impressions", label: "Impressions", icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" },
];

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export function AnalyticsClient({ profiles, series }: { profiles: ProfileRow[]; series: Snap[] }) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>("impressions");
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set(profiles.map((p) => p.id)));
  const [profileTabs, setProfileTabs] = useState<Record<string, string>>({});
  const [order, setOrder] = useState(profiles.map((p) => p.id));

  const cutoff = useMemo(() => {
    const d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const inRange = useMemo(() => series.filter((s) => s.date >= cutoff), [series, cutoff]);

  // Global chart: sum metric across selected profiles per day
  const globalSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of inRange) {
      if (!selectedProfiles.has(s.profileId)) continue;
      byDate.set(s.date, (byDate.get(s.date) ?? 0) + s[metric]);
    }
    return [...byDate.entries()].sort().map(([date, value]) => ({ date, value }));
  }, [inRange, selectedProfiles, metric]);

  const totals = useMemo(() => {
    const latestByKey = new Map<string, Snap>();
    for (const s of inRange) {
      if (!selectedProfiles.has(s.profileId)) continue;
      latestByKey.set(`${s.profileId}:${s.platform}`, s);
    }
    const t = { followers: 0, reach: 0, impressions: 0 };
    for (const s of latestByKey.values()) {
      t.followers += s.followers;
      t.reach += s.reach;
      t.impressions += s.impressions;
    }
    return t;
  }, [inRange, selectedProfiles]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (!selectedProfiles.has(p.id)) continue;
      p.accounts.forEach((a) => set.add(a.platform));
    }
    return [...set];
  }, [profiles, selectedProfiles]);

  function exportCsv() {
    const rows = [["profile", "platform", "date", "followers", "reach", "impressions", "views", "likes", "comments", "shares"]];
    const nameById = new Map(profiles.map((p) => [p.id, p.name]));
    for (const s of inRange) {
      rows.push([nameById.get(s.profileId) ?? s.profileId, s.platform, s.date, ...[s.followers, s.reach, s.impressions, s.views, s.likes, s.comments, s.shares].map(String)]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `socialpost-analytics-${cutoff}.csv`;
    a.click();
  }

  async function fixAccount(id: string) {
    await fetch("/api/internal/social-accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const orderedProfiles = order
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as ProfileRow[];

  const toDate = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Analytics</p>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">User Analytics</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            View analytics for your connected social media accounts. Note that some platforms may
            have limitations on historical data availability.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary text-sm">⬇ Export CSV</button>
          <button onClick={() => setOrder(profiles.map((p) => p.id))} className="btn-secondary text-sm">↺ Reset Order</button>
        </div>
      </div>

      {/* Period */}
      <section className="card mt-6 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select className="input w-44" value={days} onChange={(e) => setDays(+e.target.value)} aria-label="Period">
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>{p.label}</option>
            ))}
          </select>
          <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            📅 {cutoff} to {toDate}
          </span>
        </div>
      </section>

      {/* Global analytics */}
      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Global Analytics</h2>
            <p className="text-sm text-slate-400">
              Aggregated analytics for all selected profiles <span className="text-xs">({cutoff} to {toDate})</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{selectedProfiles.size} / {profiles.length} selected</span>
            <button onClick={() => setSelectedProfiles(new Set(profiles.map((p) => p.id)))} disabled={selectedProfiles.size === profiles.length} className="btn-secondary px-3 py-1 text-xs">Select All</button>
            <button onClick={() => setSelectedProfiles(new Set())} className="btn-secondary px-3 py-1 text-xs">Deselect All</button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources:</span>
          {sources.map((p) => (
            <PlatformIcon key={p} platform={p} size={16} />
          ))}
          {sources.length === 0 && <span className="text-xs text-slate-400">none</span>}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                metric === m.key
                  ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                  : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.label} ⓘ</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                  <path d={m.icon} />
                </svg>
              </div>
              <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
                {totals[m.key].toLocaleString()}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 h-72">
          {globalSeries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18M18.5 8l-5 5-3-3L7 13.5" /></svg>
              <p className="mt-2 text-sm">No chart data available for this metric and period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={globalSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v) => [Number(v).toLocaleString(), METRICS.find((m) => m.key === metric)?.label]}
                />
                <Legend />
                <Area type="monotone" dataKey="value" name={METRICS.find((m) => m.key === metric)?.label} stroke="#22C55E" strokeWidth={2} fill="url(#metricFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Per-profile platform performance */}
      {orderedProfiles.map((p, idx) => {
        const tab = profileTabs[p.id] ?? p.accounts[0]?.platform;
        const acc = p.accounts.find((a) => a.platform === tab);
        const platformSeries = inRange.filter((s) => s.profileId === p.id && s.platform === tab);
        const latest = platformSeries[platformSeries.length - 1];
        return (
          <section key={p.id} className="card mt-6 p-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedProfiles.has(p.id)}
                onChange={(e) => {
                  const next = new Set(selectedProfiles);
                  if (e.target.checked) next.add(p.id);
                  else next.delete(p.id);
                  setSelectedProfiles(next);
                }}
                aria-label={`Include ${p.name} in global analytics`}
                className="h-4 w-4 accent-emerald-600 cursor-pointer"
              />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{p.name}</h3>
                <p className="text-xs text-slate-400">Platform performance</p>
              </div>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => {
                    const next = [...order];
                    const i = next.indexOf(p.id);
                    if (i > 0) [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    setOrder(next);
                  }}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="btn-secondary px-2 py-1 text-xs"
                >↑</button>
                <button
                  onClick={() => {
                    const next = [...order];
                    const i = next.indexOf(p.id);
                    if (i < next.length - 1) [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    setOrder(next);
                  }}
                  disabled={idx === orderedProfiles.length - 1}
                  aria-label="Move down"
                  className="btn-secondary px-2 py-1 text-xs"
                >↓</button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.accounts.map((a) => (
                <button
                  key={a.platform}
                  onClick={() => setProfileTabs({ ...profileTabs, [p.id]: a.platform })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    tab === a.platform
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <PlatformIcon platform={a.platform} size={13} className={tab === a.platform ? "invert dark:invert-0" : ""} />
                  {PLATFORM_MAP[a.platform]?.name}
                </button>
              ))}
            </div>

            {acc && (
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={acc.platform} size={22} />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{PLATFORM_MAP[acc.platform]?.name}</p>
                    <p className="text-xs text-slate-400">{acc.handle}</p>
                  </div>
                </div>

                {acc.status === "needs_reauth" ? (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-500">⚠</span>
                      <span>
                        <span className="block font-semibold text-red-700 dark:text-red-300">Could not load data</span>
                        <span className="block text-xs text-red-500 dark:text-red-400">Reauth required</span>
                      </span>
                    </div>
                    <button onClick={() => fixAccount(acc.id)} className="btn-secondary px-3 py-1 text-xs">Fix</button>
                  </div>
                ) : latest ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                      {(["followers", "reach", "impressions", "views", "likes", "comments", "shares"] as const).map((k) => (
                        <div key={k} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                          <p className="text-lg font-extrabold text-slate-900 dark:text-white">{latest[k].toLocaleString()}</p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={platformSeries}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={48} />
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                          <Area type="monotone" dataKey={metric} stroke={PLATFORM_MAP[acc.platform]?.color ?? "#22C55E"} strokeWidth={2} fillOpacity={0.12} fill={PLATFORM_MAP[acc.platform]?.color ?? "#22C55E"} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">No data for this period.</p>
                )}
              </div>
            )}
            {p.accounts.length === 0 && (
              <p className="mt-4 text-sm text-slate-400">No connected accounts on this profile.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
