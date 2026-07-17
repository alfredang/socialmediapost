"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CodeBlock } from "@/components/CodeBlock";
import { StatusBadge } from "@/components/StatusBadge";
import { PLATFORM_MAP } from "@/lib/platforms";

interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const SNIPPETS = (key: string) => ({
  cURL: `curl \\
  -H 'Authorization: Apikey ${key}' \\
  -F 'video=@/path/to/your/video.mp4' \\
  -F 'title="Your Video Title 🚀"' \\
  -F 'user="your_profile_user"' \\
  -F 'platform[]=tiktok' \\
  -F 'platform[]=instagram' \\
  -F 'platform[]=youtube' \\
  -X POST http://localhost:3000/api/upload`,
  JavaScript: `import { SocialPost } from "socialpost-sdk";

const client = new SocialPost("${key}");

const result = await client.uploadVideo({
  video: "./video.mp4",
  title: "Your Video Title 🚀",
  user: "your_profile_user",
  platforms: ["tiktok", "instagram", "youtube"],
});
console.log(result.results);`,
  Python: `from socialpost import SocialPostClient

client = SocialPostClient("${key}")

result = client.upload_video(
    video="./video.mp4",
    title="Your Video Title 🚀",
    user="your_profile_user",
    platforms=["tiktok", "instagram", "youtube"],
)
print(result["results"])`,
});

const VIDEO_REQUIREMENTS: Record<string, { rows: [string, string][] }> = {
  tiktok: { rows: [["Formats", "MP4, WebM, MOV"], ["Max duration", "10 minutes"], ["Aspect ratio", "9:16 recommended"], ["Max size", "4 GB"], ["Title limit", "150 characters"]] },
  instagram: { rows: [["Formats", "MP4, MOV"], ["Max duration", "15 minutes (Reels)"], ["Aspect ratio", "9:16 or 1:1"], ["Max size", "1 GB"], ["Caption limit", "2,200 characters"]] },
  youtube: { rows: [["Formats", "MP4, MOV, AVI, WebM"], ["Max duration", "12 hours"], ["Aspect ratio", "16:9 or 9:16 (Shorts)"], ["Max size", "256 GB"], ["Title limit", "100 characters"]] },
  linkedin: { rows: [["Formats", "MP4"], ["Max duration", "10 minutes"], ["Aspect ratio", "16:9, 1:1, 9:16"], ["Max size", "5 GB"], ["Post limit", "3,000 characters"]] },
  facebook: { rows: [["Formats", "MP4, MOV"], ["Max duration", "4 hours (90s Reels)"], ["Aspect ratio", "any"], ["Max size", "10 GB"], ["Post limit", "63,206 characters"]] },
  x: { rows: [["Formats", "MP4"], ["Max duration", "2:20"], ["Aspect ratio", "16:9 or 1:1"], ["Max size", "512 MB"], ["Post limit", "280 weighted characters"]] },
  threads: { rows: [["Formats", "MP4, MOV"], ["Max duration", "5 minutes"], ["Aspect ratio", "9:16 recommended"], ["Max size", "1 GB"], ["Post limit", "500 characters"]] },
};

export function ApiKeysClient({
  plan,
  keys,
  usage,
}: {
  plan: { id: string; name: string; ffmpegMinutes: number; uploads: number };
  keys: KeyRow[];
  usage: { apiCalls: number; ffmpegUsed: number; ffmpegRequests: number };
}) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<"cURL" | "JavaScript" | "Python">("cURL");
  const [reqTab, setReqTab] = useState("tiktok");

  const exampleKey = newKey ?? "your-api-key-here";
  const snippets = SNIPPETS(exampleKey);

  async function createKey() {
    const label = window.prompt("Name this key", "Production Key");
    if (label === null) return;
    const res = await fetch("/api/internal/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (data.success) {
      setNewKey(data.key);
      router.refresh();
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this key? Requests using it will stop working immediately.")) return;
    await fetch(`/api/internal/keys?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  const timeSavedMin = usage.apiCalls * 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">API Keys</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Generate and manage API keys to authenticate requests against the SocialPost API. Keep
          them secret — anyone with a key can post on your behalf.
        </p>
      </div>

      {newKey && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Your new API key — copy it now, it won&apos;t be shown again:
          </p>
          <code className="mt-2 block break-all rounded-lg bg-white dark:bg-slate-900 border border-green-200 dark:border-green-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100">
            {newKey}
          </code>
        </div>
      )}

      {/* Keys table */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your API keys</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your authentication credentials.</p>
          </div>
          <button onClick={createKey} className="btn-primary">+ Create Key</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2.5 pr-4">Name</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Key</th>
                <th className="py-2.5 pr-4">Created</th>
                <th className="py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{k.label}</td>
                  <td className="py-3 pr-4"><StatusBadge status={k.status} /></td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <code className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {revealed === k.id ? `${k.prefix}••••••••••••` : `${k.prefix.slice(0, 6)}… ••••`}
                      </code>
                      <button
                        onClick={() => setRevealed(revealed === k.id ? null : k.id)}
                        aria-label="Toggle key visibility"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    {k.status === "active" && (
                      <button
                        onClick={() => revoke(k.id)}
                        className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">No keys yet — create your first key.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* API usage */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            API Usage
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">{plan.name}</span>
          </h2>
          <Link href="/pricing" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">View plans →</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current usage</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{usage.apiCalls}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">API calls made this cycle</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time saved</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
              {Math.floor(timeSavedMin / 60)}h {timeSavedMin % 60}m
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Compared to manual posting</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly quota</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{plan.uploads}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">uploads / month on {plan.name}</p>
          </div>
        </div>
      </section>

      {/* FFmpeg processing */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            FFmpeg Video Processing
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">{plan.name}</span>
          </h2>
          <Link href="/docs#ffmpeg" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Docs</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Used", value: `${usage.ffmpegUsed.toFixed(1)} min`, sub: "Video minutes processed" },
            { label: "Remaining", value: `${Math.max(0, plan.ffmpegMinutes - usage.ffmpegUsed).toFixed(1)} min`, sub: "Minutes left this month", accent: true },
            { label: "Monthly quota", value: `${plan.ffmpegMinutes} min`, sub: `(${Math.round(plan.ffmpegMinutes / 60)} hours)` },
            { label: "Total requests", value: String(usage.ffmpegRequests), sub: "Videos processed this month" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className={`mt-1 text-2xl font-extrabold ${s.accent ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}>{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Video Processing Usage</span>
            <span>{usage.ffmpegUsed.toFixed(1)} / {plan.ffmpegMinutes} min</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (usage.ffmpegUsed / plan.ffmpegMinutes) * 100)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Usage instructions */}
      <section className="card p-6" id="usage">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Usage Instructions</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Use any of your active API keys in the{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-xs">Authorization</code> header.
        </p>
        <div className="mt-4 flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 w-fit">
          {(["cURL", "JavaScript", "Python"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSnippetTab(t)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                snippetTab === t ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <CodeBlock code={snippets[snippetTab]} />
        </div>
      </section>

      {/* Parameters documentation */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">API Parameters Documentation</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          For more details, see the <Link href="/docs" className="text-emerald-600 dark:text-emerald-400 underline">API Parameters Documentation</Link>.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { name: "video / photos[]", desc: "The video or photo file(s) you want to upload. Provide a local file path or a direct URL. See platform-specific requirements for supported formats." },
            { name: "title", desc: "The description that will appear on your post. You can include hashtags and emoji in the title." },
            { name: "user", desc: "The profile name you created in the User Management section. Create a profile and link social accounts before making requests.", link: { href: "/users", label: "Manage Users →" } },
            { name: "platform", desc: "The platform(s) to publish to. Repeat platform[] for each network — TikTok, Instagram, YouTube, LinkedIn, Facebook, X, Threads and 15 more." },
          ].map((p) => (
            <div key={p.name} className="card p-5">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{p.name}</code>
                <span className="rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">required</span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.desc}</p>
              {p.link && (
                <Link href={p.link.href} className="mt-2 inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                  {p.link.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Video format requirements */}
      <section className="card p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Video Format Requirements</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Platform-specific limits for uploaded video files.</p>
        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
          {Object.keys(VIDEO_REQUIREMENTS).map((k) => (
            <button
              key={k}
              onClick={() => setReqTab(k)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                reqTab === k
                  ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-600"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {PLATFORM_MAP[k]?.name ?? k}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <tbody>
              {VIDEO_REQUIREMENTS[reqTab].rows.map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2.5 pr-6 font-medium text-slate-700 dark:text-slate-300 w-48">{k}</td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-sm">
        <Link href="/connected-apps" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
          Connected Apps (OAuth / MCP integrations) →
        </Link>
      </div>
    </div>
  );
}
