"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Select } from "@/components/Select";
import { PLATFORM_MAP, analyticsMetricsFor, MetricKey } from "@/lib/platforms";

// null = the platform does not expose this metric to us. Distinct from 0,
// which is a number we actually measured.
type MetricValue = number | null;

interface Snap {
  profileId: string;
  platform: string;
  date: string;
  followers: MetricValue;
  reach: MetricValue;
  impressions: MetricValue;
  views: MetricValue;
  likes: MetricValue;
  comments: MetricValue;
  shares: MetricValue;
}
// One published post's latest engagement, tagged with its publish date so the
// client can aggregate it for any selected period.
interface PostRow {
  profileId: string;
  platform: string;
  date: string;
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

// Engagement metrics are discrete event counts, so summing them across
// platforms is meaningful (a like on IG + a like on FB really is two likes).
type EngagementKey = "views" | "likes" | "comments" | "shares";
const ENGAGEMENT: { key: EngagementKey; label: string; icon: string }[] = [
  { key: "views", label: "Views", icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  { key: "likes", label: "Likes", icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" },
  { key: "comments", label: "Comments", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" },
  { key: "shares", label: "Shares", icon: "M18 8a3 3 0 1 0-2.83-4M6 15a3 3 0 1 0 .01 0M18 22a3 3 0 1 0 .01 0M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" },
];

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export function AnalyticsClient({
  profiles,
  series,
  postMetrics,
}: {
  profiles: ProfileRow[];
  series: Snap[];
  postMetrics: PostRow[];
}) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [chartMetric, setChartMetric] = useState<"followers" | EngagementKey>("followers");
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set(profiles.map((p) => p.id)));
  const [profileTabs, setProfileTabs] = useState<Record<string, string>>({});
  const [order, setOrder] = useState(profiles.map((p) => p.id));
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch("/api/internal/analytics/sync", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setSyncNote(data.error ?? "Sync failed.");
      } else if (data.accounts_checked === 0) {
        setSyncNote(
          "No connected accounts support analytics yet — connect Instagram, Facebook or TikTok to collect numbers."
        );
      } else {
        setSyncNote(
          `Checked ${data.accounts_checked} account(s): ${data.snapshots_written} snapshot(s) and ${data.post_metrics_written} post metric(s) updated.`
        );
        router.refresh();
      }
    } catch {
      setSyncNote("Sync failed — please try again.");
    }
    setSyncing(false);
  }

  const cutoff = useMemo(() => {
    const d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const inRange = useMemo(() => series.filter((s) => s.date >= cutoff), [series, cutoff]);
  const postsInRange = useMemo(() => postMetrics.filter((m) => m.date >= cutoff), [postMetrics, cutoff]);

  // Global chart, driven by the selected tile. Followers is a daily audience
  // total from the snapshots; engagement metrics are summed from posts by
  // publish date (so the line reads "engagement earned by posts published each
  // day"). Both sum sensibly across platforms — see the note by the tiles.
  const globalSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    if (chartMetric === "followers") {
      for (const s of inRange) {
        if (!selectedProfiles.has(s.profileId)) continue;
        if (s.followers === null) continue;
        byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.followers);
      }
    } else {
      for (const m of postsInRange) {
        if (!selectedProfiles.has(m.profileId)) continue;
        byDate.set(m.date, (byDate.get(m.date) ?? 0) + m[chartMetric]);
      }
    }
    return [...byDate.entries()].sort().map(([date, value]) => ({ date, value }));
  }, [inRange, postsInRange, selectedProfiles, chartMetric]);

  const chartLabel =
    chartMetric === "followers"
      ? "Total followers"
      : ENGAGEMENT.find((m) => m.key === chartMetric)!.label;

  // Total reachable audience: the latest follower count per connected account,
  // summed across selected profiles. null until at least one account reports.
  const audienceTotal = useMemo(() => {
    const latestByKey = new Map<string, Snap>();
    for (const s of inRange) {
      if (!selectedProfiles.has(s.profileId)) continue;
      latestByKey.set(`${s.profileId}:${s.platform}`, s);
    }
    let total: number | null = null;
    for (const s of latestByKey.values()) {
      if (s.followers === null) continue;
      total = (total ?? 0) + s.followers;
    }
    return total;
  }, [inRange, selectedProfiles]);

  // Engagement totals across selected profiles for the period. These are event
  // counts, so cross-platform sums are legitimate. posts = how many published
  // posts contributed, so the tiles can distinguish "0 engagement" from "no data".
  const engagementTotals = useMemo(() => {
    const t = { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 };
    for (const m of postsInRange) {
      if (!selectedProfiles.has(m.profileId)) continue;
      t.views += m.views;
      t.likes += m.likes;
      t.comments += m.comments;
      t.shares += m.shares;
      t.posts += 1;
    }
    return t;
  }, [postsInRange, selectedProfiles]);

  // Per-profile+platform engagement for the panels, aggregated for the period.
  const postAggByKey = useMemo(() => {
    const map = new Map<string, { views: number; likes: number; comments: number; shares: number; posts: number }>();
    for (const m of postsInRange) {
      const key = `${m.profileId}:${m.platform}`;
      const agg = map.get(key) ?? { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 };
      agg.views += m.views;
      agg.likes += m.likes;
      agg.comments += m.comments;
      agg.shares += m.shares;
      agg.posts += 1;
      map.set(key, agg);
    }
    return map;
  }, [postsInRange]);

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
      // Unavailable metrics export as empty cells, not zeros.
      const cells = [s.followers, s.reach, s.impressions, s.views, s.likes, s.comments, s.shares];
      rows.push([nameById.get(s.profileId) ?? s.profileId, s.platform, s.date, ...cells.map((v) => (v === null ? "" : String(v)))]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `socialpost-analytics-${cutoff}.csv`;
    a.click();
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
            These figures come from each platform directly and refresh every few hours. You&apos;ll
            see data from the day you connected an account onwards, since platforms don&apos;t let
            us fetch their past numbers. A dash instead of a number means that platform doesn&apos;t
            share that particular figure.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncNow} disabled={syncing} className="btn-secondary text-sm">
            {syncing ? "Syncing…" : "⟳ Sync now"}
          </button>
          <button onClick={exportCsv} className="btn-secondary text-sm">⬇ Export CSV</button>
          <button onClick={() => setOrder(profiles.map((p) => p.id))} title="Restore the original profile order" className="btn-secondary text-sm">↺ Reset Order</button>
        </div>
      </div>

      {syncNote && (
        <p className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          {syncNote}
        </p>
      )}

      {/* Period — relative z-20 lifts this card (and the Period dropdown inside
          it) above the following cards, whose dark:backdrop-blur each start a
          new stacking context that would otherwise paint over the dropdown. */}
      <section className="card relative z-20 mt-6 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Select
            ariaLabel="Period"
            className="w-44"
            value={String(days)}
            onChange={(v) => setDays(+v)}
            options={PERIODS.map((p) => ({ value: String(p.days), label: p.label }))}
          />
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

        {/* Audience (followers, summed across platforms) + engagement totals.
            Each tile selects what the chart below plots. Reach/impressions are
            deliberately NOT aggregated here — see the note. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <button
            onClick={() => setChartMetric("followers")}
            aria-pressed={chartMetric === "followers"}
            className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
              chartMetric === "followers"
                ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total audience</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
              {audienceTotal === null ? (
                <span className="text-slate-300 dark:text-slate-600" title="No connected account reports followers yet">—</span>
              ) : (
                audienceTotal.toLocaleString()
              )}
            </p>
            <p className="text-[10px] text-slate-400">followers across all platforms</p>
          </button>

          {ENGAGEMENT.map((m) => (
            <button
              key={m.key}
              onClick={() => setChartMetric(m.key)}
              aria-pressed={chartMetric === m.key}
              className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                chartMetric === m.key
                  ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                  : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.label}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                  <path d={m.icon} />
                </svg>
              </div>
              <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
                {engagementTotals.posts === 0 ? (
                  <span className="text-slate-300 dark:text-slate-600" title="No post metrics collected for this period yet">—</span>
                ) : (
                  engagementTotals[m.key].toLocaleString()
                )}
              </p>
              <p className="text-[10px] text-slate-400">this period</p>
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          Pick a tile to chart it below. Audience is summed followers; engagement is summed across{" "}
          {engagementTotals.posts} post{engagementTotals.posts === 1 ? "" : "s"}{" "}
          published in this period. Reach and impressions aren&apos;t totalled here — they count
          viewers per platform and can&apos;t be added across platforms without double-counting, so
          they live in each platform&apos;s panel below.
        </p>

        <div className="mt-5 h-72">
          {globalSeries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18M18.5 8l-5 5-3-3L7 13.5" /></svg>
              <p className="mt-2 text-sm">
                {chartMetric === "followers"
                  ? "No follower history for this period yet."
                  : `No ${chartLabel.toLowerCase()} recorded for posts in this period yet.`}
              </p>
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
                  labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                  formatter={(v) => [Number(v).toLocaleString(), chartLabel]}
                />
                <Legend />
                <Area type="monotone" dataKey="value" name={chartLabel} stroke="#22C55E" strokeWidth={2} fill="url(#metricFill)" />
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

        // Only the metrics this platform actually reports, split by where the
        // number comes from. Account metrics read from the latest daily
        // snapshot; post metrics from the period's summed engagement.
        const metricDefs = analyticsMetricsFor(tab);
        const agg = postAggByKey.get(`${p.id}:${tab}`);
        const metricValue = (def: { key: MetricKey; source: "account" | "post" }): MetricValue => {
          if (def.source === "account") return latest ? latest[def.key] : null;
          if (!agg) return null;
          return agg[def.key as EngagementKey];
        };
        // The area chart only plots account-level time series; prefer followers,
        // else this platform's first account metric.
        const accountKeys = metricDefs.filter((d) => d.source === "account").map((d) => d.key);
        const chartKey = (accountKeys.includes("followers") ? "followers" : accountKeys[0]) as MetricKey | undefined;
        const hasData = Boolean(latest || agg);
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
              <div className="ml-auto flex items-center gap-1.5">
                <span className="hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
                  Reorder
                </span>
                <button
                  onClick={() => {
                    const next = [...order];
                    const i = next.indexOf(p.id);
                    if (i > 0) [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    setOrder(next);
                  }}
                  disabled={idx === 0}
                  aria-label={`Move ${p.name} up`}
                  title={`Move ${p.name} up`}
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
                  aria-label={`Move ${p.name} down`}
                  title={`Move ${p.name} down`}
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
                        <span className="block text-xs text-red-500 dark:text-red-400">
                          This account&apos;s authorization expired — reconnect it to resume collecting metrics.
                        </span>
                      </span>
                    </div>
                    <Link href="/users" className="btn-secondary px-3 py-1 text-xs">Reconnect</Link>
                  </div>
                ) : metricDefs.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">
                    SocialPost doesn&apos;t collect analytics for {PLATFORM_MAP[acc.platform]?.name} yet.
                  </p>
                ) : hasData ? (
                  <>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {metricDefs.map((def) => {
                        const value = metricValue(def);
                        return (
                          <div key={`${def.key}-${def.source}`} className="min-w-[84px] flex-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                            <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                              {value === null ? (
                                <span
                                  className="text-slate-300 dark:text-slate-600"
                                  title={`Not collected yet — connect the account and run Sync now`}
                                >
                                  —
                                </span>
                              ) : (
                                value.toLocaleString()
                              )}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">{def.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    {agg && (
                      <p className="mt-2 text-[10px] text-slate-400">
                        Engagement summed across {agg.posts} published post{agg.posts === 1 ? "" : "s"} in this period.
                      </p>
                    )}
                    {chartKey && platformSeries.length > 0 && (
                      <div className="mt-4 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={platformSeries}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={48} />
                            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#0f172a", fontWeight: 600 }} />
                            <Area type="monotone" dataKey={chartKey} stroke={PLATFORM_MAP[acc.platform]?.color ?? "#22C55E"} strokeWidth={2} fillOpacity={0.12} fill={PLATFORM_MAP[acc.platform]?.color ?? "#22C55E"} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    No data collected yet for this period — use <span className="font-semibold">Sync now</span> once the account is connected.
                  </p>
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
