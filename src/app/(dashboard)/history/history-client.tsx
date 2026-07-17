"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformIcon } from "@/components/PlatformIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { PLATFORM_MAP } from "@/lib/platforms";

interface Row {
  id: string;
  postId: string;
  platform: string;
  profile: string;
  status: string;
  when: string;
  title: string;
  body: string;
  mediaType: string;
  mediaSize: number;
  url: string | null;
  error: string | null;
  metrics: { views: number; likes: number; comments: number; shares: number } | null;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.floor(abs / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  const s = d > 0 ? (d === 1 ? "yesterday" : `${d} days`) : h > 0 ? `${h} hours` : `${Math.max(1, min)} min`;
  if (d === 1 && !future) return "yesterday";
  return future ? `in ${s}` : `${s} ago`;
}

function size(bytes: number) {
  if (!bytes) return "—";
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function HistoryClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [analyticsRow, setAnalyticsRow] = useState<Row | null>(null);

  const platforms = useMemo(() => [...new Set(rows.map((r) => r.platform))], [rows]);
  const filtered = rows.filter(
    (r) => (platform === "all" || r.platform === platform) && (status === "all" || r.status === status)
  );

  async function retry(postId: string) {
    await fetch("/api/internal/posts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, action: "retry" }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Upload History</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Review every post pushed across your connected platforms. Retry failures, inspect
            analytics, and monitor in-flight uploads.
          </p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
          </svg>
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="mt-4 flex flex-wrap gap-3">
          <select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Filter by platform">
            <option value="all">All platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{PLATFORM_MAP[p]?.name ?? p}</option>
            ))}
          </select>
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {["published", "failed", "pending", "scheduled", "draft"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Content</th>
              <th className="px-4 py-3">Media</th>
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No uploads match these filters.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    <PlatformIcon platform={r.platform} size={18} />
                    {PLATFORM_MAP[r.platform]?.name ?? r.platform}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.profile}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{relative(r.when)}</td>
                <td className="px-4 py-3 max-w-56">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{r.title || "—"}</p>
                  {r.body && <p className="truncate text-xs text-slate-400">{r.body}</p>}
                  {r.error && <p className="truncate text-xs text-red-500">{r.error}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap capitalize">
                  {r.mediaType}
                  <span className="block text-xs text-slate-400">{size(r.mediaSize)}</span>
                </td>
                <td className="px-4 py-3">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>
                      View
                    </a>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setAnalyticsRow(r)} className="btn-secondary px-3 py-1 text-xs">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" /></svg>
                      Analytics
                    </button>
                    {r.status === "failed" && (
                      <button onClick={() => retry(r.postId)} className="rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer">
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analyticsRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAnalyticsRow(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <PlatformIcon platform={analyticsRow.platform} size={18} /> Post analytics
              </h2>
              <button onClick={() => setAnalyticsRow(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Close">✕</button>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{analyticsRow.title}</p>
            {analyticsRow.metrics ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(analyticsRow.metrics).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{v.toLocaleString()}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{k}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No metrics yet — analytics appear after publishing.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
