"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlatformIcon } from "@/components/PlatformIcon";
import { CodeBlock } from "@/components/CodeBlock";
import { EmojiPicker } from "@/components/EmojiPicker";
import { PLATFORMS, PLATFORM_MAP, adaptContent, graphemeLength, PostType } from "@/lib/platforms";

interface ProfileOpt {
  id: string;
  name: string;
  connected: { platform: string; handle: string; status: string }[];
}

type Method = "file" | "url" | "text";
type Submission = "now" | "schedule" | "queue" | "draft";

export function UploadClient({ profiles }: { profiles: ProfileOpt[] }) {
  const [tab, setTab] = useState<"manual" | "shorts">("manual");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [method, setMethod] = useState<Method>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [mediaUrls, setMediaUrls] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [asyncUpload, setAsyncUpload] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: { platform: string; success: boolean; url?: string; error?: string }[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = profiles.find((p) => p.id === profileId);
  const connectedMap = useMemo(
    () => new Map((profile?.connected ?? []).map((c) => [c.platform, c])),
    [profile]
  );

  const postType: PostType = method === "text" ? "text" : files.some((f) => f.type.startsWith("video")) || (method === "url" && /\.(mp4|mov|webm)/i.test(mediaUrls)) ? "video" : method === "file" || method === "url" ? (files.length || mediaUrls ? "photos" : "video") : "text";

  const eligiblePlatforms = PLATFORMS.filter((p) => p.supports.includes(postType));

  function toggle(platform: string) {
    setSelected((s) => (s.includes(platform) ? s.filter((x) => x !== platform) : [...s, platform]));
  }

  function addEmoji(setter: (fn: (v: string) => string) => void) {
    return (emoji: string) => setter((v) => v + emoji);
  }

  async function generateAI() {
    setAiBusy(true);
    const res = await fetch("/api/internal/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    setAiBusy(false);
    if (data.success) {
      setTitle(data.title);
      setDescription(`${data.description}\n\n${data.hashtags.join(" ")}`);
    }
  }

  const curl = useMemo(() => {
    const endpoint = postType === "text" ? "upload_text" : postType === "photos" ? "upload_photos" : "upload";
    const mediaLine =
      postType === "text"
        ? ""
        : postType === "photos"
          ? (files.length ? files : [{ name: "image1.jpg" }]).map((f) => `  -F 'photos[]=@/path/to/${f.name}' \\\n`).join("")
          : `  -F 'video=@/path/to/${files[0]?.name ?? "video.mp4"}' \\\n`;
    return `curl \\
  -H 'Authorization: Apikey your-api-key-here' \\
${mediaLine}  -F 'title="${(title || "Your Awesome Title").replace(/"/g, '\\"')}"' \\
  -F 'user="${profile?.name ?? "your_profile_user"}"' \\
${selected.map((p) => `  -F 'platform[]=${p}' \\`).join("\n")}${selected.length ? "\n" : ""}${submission === "schedule" && scheduledAt ? `  -F 'scheduled_date=${new Date(scheduledAt).toISOString()}' \\\n` : ""}  -X POST http://localhost:3000/api/${endpoint}`;
  }, [postType, files, title, profile, selected, submission, scheduledAt]);

  async function submit() {
    if (!profile || selected.length === 0) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    form.set("profileId", profile.id);
    form.set("type", postType);
    form.set("title", title);
    form.set("description", description);
    form.set("firstComment", firstComment);
    form.set("platforms", JSON.stringify(selected));
    form.set("overrides", JSON.stringify(overrides));
    form.set("mode", submission);
    if (submission === "schedule") form.set("scheduledAt", scheduledAt);
    if (method === "url") {
      form.set("mediaUrls", JSON.stringify(mediaUrls.split("\n").map((s) => s.trim()).filter(Boolean)));
    }
    for (const f of files) form.append("media", f);

    const res = await fetch("/api/internal/posts", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!data.success) {
      setResult({ ok: false, message: data.error ?? "Upload failed" });
      return;
    }
    if (submission === "now") {
      setResult({
        ok: data.status !== "failed",
        message: `Publish ${data.status}`,
        details: data.results,
      });
    } else {
      setResult({
        ok: true,
        message:
          submission === "draft"
            ? "Saved as draft."
            : `Scheduled for ${new Date(data.scheduledAt).toLocaleString()}`,
      });
    }
  }

  const typeLabel = postType === "video" ? "Video" : postType === "photos" ? "Photos" : "Post";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6 min-w-0">
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-fit">
          {(["manual", "shorts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                tab === t ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t === "manual" ? "Manual" : "Shorts Uploader"}
            </button>
          ))}
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Upload to all platforms with one click
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            {tab === "manual"
              ? <>Manually upload content to multiple social media platforms at once. As you configure your upload, the equivalent cURL command is generated below — copy it into automation workflows with tools like n8n or Make. For full automation, use our <Link href="/docs" className="text-emerald-600 dark:text-emerald-400 underline">API</Link>.</>
              : "Shorts mode: pick one vertical video and blast it to TikTok, Instagram Reels and YouTube Shorts in one shot."}
          </p>
        </div>

        {/* Core content */}
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Set up core content</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pick the profile, content source, and primary copy.</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
              {files.length || mediaUrls || method === "text" ? "Ready" : "Media pending"}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="profile">Select Profile</label>
              <span className="text-xs text-slate-400">Content will be posted using this profile&apos;s connected accounts.</span>
            </div>
            <select id="profile" className="input" value={profileId} onChange={(e) => { setProfileId(e.target.value); setSelected([]); }}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Connected: {profile?.connected.map((c) => c.platform).join(", ") || "none — connect accounts in User Management"}
            </p>
          </div>

          <div className="mt-5">
            <span className="label">Select Upload Method</span>
            <div className="flex flex-wrap gap-4">
              {([["file", "Upload Media File"], ["url", "Use Media URL(s)"], ["text", "Text-Only Post"]] as [Method, string][]).map(([m, label]) => (
                <label key={m} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-emerald-600" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {method === "file" && tab === "manual" && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="label">Upload Media File</span>
                <span className="text-xs text-slate-400">Images, Videos or Documents (LinkedIn)</span>
              </div>
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                <button onClick={() => fileInput.current?.click()} className="bg-slate-900 dark:bg-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white cursor-pointer">
                  Choose files
                </button>
                <span className="px-3 text-sm text-slate-500 dark:text-slate-400 truncate">
                  {files.length ? files.map((f) => f.name).join(", ") : "No file chosen"}
                </span>
                <input ref={fileInput} type="file" multiple accept="video/*,image/*,.pdf,.ppt,.pptx,.doc,.docx" className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </div>
            </div>
          )}
          {method === "file" && tab === "shorts" && (
            <div className="mt-5">
              <span className="label">Vertical video (9:16)</span>
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                <button onClick={() => fileInput.current?.click()} className="bg-slate-900 dark:bg-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white cursor-pointer">
                  Choose video
                </button>
                <span className="px-3 text-sm text-slate-500 dark:text-slate-400 truncate">
                  {files[0]?.name ?? "No video chosen"}
                </span>
                <input ref={fileInput} type="file" accept="video/*" className="hidden"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []).slice(0, 1));
                    setSelected(["tiktok", "instagram", "youtube"].filter((p) => connectedMap.has(p)));
                  }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">Auto-selects TikTok, Instagram Reels and YouTube Shorts.</p>
            </div>
          )}
          {method === "url" && (
            <div className="mt-5">
              <label className="label" htmlFor="urls">Media URL(s) — one per line</label>
              <textarea id="urls" className="input min-h-20 font-mono text-xs" placeholder="https://example.com/video.mp4" value={mediaUrls} onChange={(e) => setMediaUrls(e.target.value)} />
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="title">Title</label>
              <span className="text-xs text-slate-400">Optional — used as caption/description</span>
            </div>
            <div className="relative">
              <textarea id="title" className="input min-h-20 pr-10" placeholder="Enter title for your post" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="absolute right-2 top-2">
                <EmojiPicker onPick={addEmoji(setTitle)} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">AI copy:</span>
              <button onClick={generateAI} disabled={aiBusy} className="rounded-md bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-50">
                {aiBusy ? "Generating…" : "✦ Generate now"}
              </button>
              <span className="text-slate-400">Improves your title, writes a caption and suggests hashtags.</span>
            </div>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              This Title is a global field used across all platforms during upload. By default it also
              serves as the description/caption when a platform-specific description is not provided.
              Mind that each network has different character limits and rules — you can override per
              platform via fields like <code className="font-mono">instagram_title</code>,{" "}
              <code className="font-mono">youtube_title</code>, <code className="font-mono">linkedin_title</code> in
              the Platform-specific settings below.
            </p>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="description">Description / Caption</label>
            <div className="relative">
              <textarea id="description" className="input min-h-24 pr-10" placeholder="Longer caption, hashtags…" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="absolute right-2 top-2">
                <EmojiPicker onPick={addEmoji(setDescription)} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="first-comment">First Comment (Optional)</label>
            <div className="relative">
              <textarea id="first-comment" className="input min-h-16 pr-10" placeholder="Post a first comment automatically (e.g., hashtags, links, etc.)" value={firstComment} onChange={(e) => setFirstComment(e.target.value)} />
              <div className="absolute right-2 top-2">
                <EmojiPicker onPick={addEmoji(setFirstComment)} />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Works on: Instagram, Facebook, Threads, Bluesky, Reddit, X, YouTube, and LinkedIn.
            </p>
          </div>
        </section>

        {/* Platform-specific settings */}
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Platform-specific settings</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enable each network and fine-tune channel options.</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selected.length ? `${selected.length} selected` : "None selected"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {eligiblePlatforms.map((pl) => {
              const acc = connectedMap.get(pl.id);
              const isSelected = selected.includes(pl.id);
              const disabled = !acc;
              return (
                <div key={pl.id} className={`rounded-xl border p-3 transition-colors ${isSelected ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"} ${disabled ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => !disabled && toggle(pl.id)}
                      disabled={disabled}
                      className={`flex items-center gap-2 min-w-0 text-left ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <PlatformIcon platform={pl.id} size={18} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{pl.name}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {acc ? `@${acc.handle}` : "Not connected"}
                        </span>
                      </span>
                    </button>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {acc && (
                        <button
                          onClick={() => setExpandedPlatform(expandedPlatform === pl.id ? null : pl.id)}
                          aria-label={`${pl.name} settings`}
                          className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                          </svg>
                        </button>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggle(pl.id)}
                        aria-label={`Select ${pl.name}`}
                        className="h-4 w-4 accent-emerald-600 cursor-pointer"
                      />
                    </span>
                  </div>
                  {expandedPlatform === pl.id && acc && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        {pl.id}_title <span className="text-slate-300">(max {pl.titleMax})</span>
                        <input
                          className="input mt-1 text-xs"
                          placeholder={`Override title for ${pl.name}`}
                          value={overrides[`${pl.id}_title`] ?? ""}
                          onChange={(e) => setOverrides({ ...overrides, [`${pl.id}_title`]: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        {pl.id}_description
                        <input
                          className="input mt-1 text-xs"
                          placeholder={`Override description for ${pl.name}`}
                          value={overrides[`${pl.id}_description`] ?? ""}
                          onChange={(e) => setOverrides({ ...overrides, [`${pl.id}_description`]: e.target.value })}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Scheduling & submission */}
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduling &amp; submission</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose when to publish and finalize the request.</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400 capitalize">
              {submission === "now" ? "Immediate" : submission}
            </span>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={asyncUpload} onChange={(e) => setAsyncUpload(e.target.checked)} className="mt-0.5 accent-emerald-600" />
            <span>
              <strong>Async upload</strong>
              <span className="block text-xs text-slate-400">If enabled, uploads are queued and processed asynchronously.</span>
            </span>
          </label>

          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="radio" name="submission" checked={submission === "now"} onChange={() => setSubmission("now")} className="mt-1 accent-emerald-600" />
              <span className="text-slate-700 dark:text-slate-300"><strong>Post immediately</strong></span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="radio" name="submission" checked={submission === "schedule"} onChange={() => setSubmission("schedule")} className="mt-1 accent-emerald-600" />
              <span className="flex-1 text-slate-700 dark:text-slate-300">
                <strong>Schedule Post</strong>
                {submission === "schedule" && (
                  <span className="mt-2 block">
                    <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                    <span className="mt-1 block text-xs text-slate-400">
                      Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Your scheduled time will be interpreted in this timezone.
                    </span>
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="radio" name="submission" checked={submission === "queue"} onChange={() => setSubmission("queue")} className="mt-1 accent-emerald-600" />
              <span className="text-slate-700 dark:text-slate-300">
                <strong>Add to Queue</strong>
                <span className="block text-xs text-slate-400">
                  Automatically schedule to your next available queue slot.{" "}
                  <Link href="/calendar/queue" className="text-emerald-600 dark:text-emerald-400 underline">Configure queue</Link>
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="radio" name="submission" checked={submission === "draft"} onChange={() => setSubmission("draft")} className="mt-1 accent-emerald-600" />
              <span className="text-slate-700 dark:text-slate-300"><strong>Save as Draft</strong></span>
            </label>
          </div>

          {result && (
            <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${result.ok ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"}`}>
              <p className="font-semibold">{result.message}</p>
              {result.details && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {result.details.map((r) => (
                    <li key={r.platform}>
                      {PLATFORM_MAP[r.platform]?.name}: {r.success ? <a href={r.url} className="underline" target="_blank" rel="noreferrer">published ✓</a> : `failed — ${r.error}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy || selected.length === 0 || (!title && !description)}
            className="btn-primary mt-5 w-full py-3"
          >
            {busy
              ? "Uploading…"
              : submission === "draft"
                ? "Save Draft"
                : submission === "now"
                  ? `Upload ${typeLabel} to ${selected.length} Platform${selected.length === 1 ? "" : "s"}`
                  : `Schedule ${typeLabel} for ${selected.length} Platform${selected.length === 1 ? "" : "s"}`}
          </button>
        </section>
      </div>

      {/* Right rail: preview + cURL */}
      <div className="space-y-4">
        <section className="card p-5 lg:sticky lg:top-20">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Post preview</h3>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">{profile?.name ?? "—"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">No platforms selected</span>
            ) : (
              selected.map((p) => (
                <span key={p} className="flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <PlatformIcon platform={p} size={11} /> {PLATFORM_MAP[p]?.name}
                </span>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {submission === "now" ? "Post immediately" : submission === "queue" ? "Queued to next slot" : submission === "draft" ? "Draft" : scheduledAt ? `Scheduled ${new Date(scheduledAt).toLocaleString()}` : "Scheduled"}
            {asyncUpload && <span className="ml-1 rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 text-[10px]">Async</span>}
            {" · "}{method === "text" ? "Text-only" : files.length ? `${files.length} attached file${files.length > 1 ? "s" : ""}` : "Attached File"}
          </p>
          <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Title</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {title || <span className="italic text-slate-400">No title set</span>}
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            {files.length && files[0].type.startsWith("image") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={URL.createObjectURL(files[0])} alt="Preview" className="mx-auto max-h-40 rounded-lg object-cover" />
            ) : (
              <>
                <svg className="mx-auto text-slate-300 dark:text-slate-600" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
                <p className="mt-2 text-xs text-slate-400">Add media to see preview</p>
              </>
            )}
          </div>

          {/* Per-platform adaptation preview */}
          {selected.length > 0 && (title || description) && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Auto-adapted per platform</p>
              <ul className="mt-2 space-y-2">
                {selected.slice(0, 5).map((p) => {
                  const adapted = adaptContent(p, { type: postType, title, description, firstComment, overrides });
                  const def = PLATFORM_MAP[p];
                  return (
                    <li key={p} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <PlatformIcon platform={p} size={12} /> {def.name}
                        <span className="ml-auto font-normal text-slate-400">
                          {graphemeLength(adapted.title)}/{def.titleMax}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 break-words line-clamp-2">{adapted.title}</p>
                      {adapted.warnings.map((w) => (
                        <p key={w} className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">⚠ {w}</p>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <CodeBlock title="Equivalent cURL" code={curl} />
      </div>
    </div>
  );
}
