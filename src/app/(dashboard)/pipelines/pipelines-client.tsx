"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformIcon } from "@/components/PlatformIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { MediaEditor, MediaValue, mediaValueToStored } from "@/components/MediaEditor";
import { PLATFORM_MAP } from "@/lib/platforms";

type ItemType = "text" | "photos" | "video";
interface PlatformOverride {
  type: ItemType;
  media: MediaValue;
}
interface WizardItem {
  type: ItemType;
  title: string;
  description: string;
  media: MediaValue; // base content (used for platforms without an override)
  customize: boolean; // give each platform its own type + media
  perPlatform: Record<string, PlatformOverride>;
}
const ITEM_TYPE_LABELS: { value: ItemType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "photos", label: "Photos" },
  { value: "video", label: "Video" },
];
const EMPTY_MEDIA: MediaValue = { media: [], urls: "" };

// Types a platform can publish, from the wizard's set.
function typesFor(platform: string): ItemType[] {
  return ITEM_TYPE_LABELS.map((t) => t.value).filter((t) => PLATFORM_MAP[platform]?.supports.includes(t));
}

interface PipelineItem {
  id: string;
  title: string;
  description: string;
  type: string;
  mediaCount: number;
  status: string;
  publishedAt: string | null;
}
interface Pipeline {
  id: string;
  name: string;
  profile: string;
  platforms: string[];
  activeDays: string[];
  slotTimes: string[];
  timezone: string;
  status: string;
  loop: boolean;
  lastRunAt: string | null;
  items: PipelineItem[];
}
interface ProfileOpt {
  id: string;
  name: string;
  platforms: string[];
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function PipelinesClient({ pipelines, profiles }: { pipelines: Pipeline[]; profiles: ProfileOpt[] }) {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [activeDays, setActiveDays] = useState<string[]>(["mon", "wed", "fri"]);
  const [slotTimes, setSlotTimes] = useState("10:00");
  const [loop, setLoop] = useState(false);
  const [items, setItems] = useState<WizardItem[]>([
    { type: "text", title: "", description: "", media: { media: [], urls: "" }, customize: false, perPlatform: {} },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = profiles.find((p) => p.id === profileId);

  // Base type options = types EVERY selected platform supports (the base applies
  // to platforms without an override). Instagram/TikTok have no "text".
  const allowedTypes = ITEM_TYPE_LABELS.map((t) => t.value).filter(
    (t) => platforms.length > 0 && platforms.every((p) => PLATFORM_MAP[p]?.supports.includes(t))
  );
  const textBlockedBy = platforms.filter((p) => !PLATFORM_MAP[p]?.supports.includes("text"));

  // A stored base type may become unsupported when platforms change; fall back
  // to the first allowed type for display/submit (no setState-in-effect).
  const effType = (it: WizardItem): ItemType =>
    allowedTypes.includes(it.type) ? it.type : allowedTypes[0] ?? it.type;

  function patchItem(idx: number, patch: Partial<WizardItem>) {
    setItems((its) => its.map((it, j) => (j === idx ? { ...it, ...patch } : it)));
  }

  // The override for one platform, defaulting to a supported type + empty media.
  function overrideFor(it: WizardItem, platform: string): PlatformOverride {
    return it.perPlatform[platform] ?? { type: typesFor(platform)[0] ?? "photos", media: { ...EMPTY_MEDIA } };
  }
  function patchOverride(idx: number, platform: string, patch: Partial<PlatformOverride>) {
    setItems((its) =>
      its.map((it, j) => {
        if (j !== idx) return it;
        const cur = it.perPlatform[platform] ?? overrideFor(it, platform);
        return { ...it, perPlatform: { ...it.perPlatform, [platform]: { ...cur, ...patch } } };
      })
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/internal/pipelines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId,
        name,
        platforms,
        activeDays,
        slotTimes: slotTimes.split(",").map((s) => s.trim()).filter(Boolean),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        loop,
        items: items
          .filter((i) => i.title || i.description || i.media.media.length || i.media.urls.trim() || i.customize)
          .map((i) => ({
            type: effType(i),
            title: i.title,
            description: i.description,
            media: mediaValueToStored(i.media),
            // When customizing, send each selected platform its own type + media.
            perPlatform: i.customize
              ? Object.fromEntries(
                  platforms.map((pl) => {
                    const o = overrideFor(i, pl);
                    return [pl, { type: o.type, media: mediaValueToStored(o.media) }];
                  })
                )
              : {},
          })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.success) return setError(data.error);
    setShowWizard(false);
    setStep(1);
    setName("");
    setPlatforms([]);
    setItems([{ type: "text", title: "", description: "", media: { media: [], urls: "" }, customize: false, perPlatform: {} }]);
    router.refresh();
  }

  async function action(id: string, act: string) {
    await fetch("/api/internal/pipelines", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: act }),
    });
    router.refresh();
  }

  async function remove(id: string, pipelineName: string) {
    if (!window.confirm(`Delete pipeline "${pipelineName}"?`)) return;
    await fetch(`/api/internal/pipelines?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addItem(id: string) {
    const title = window.prompt("Content item title");
    if (!title) return;
    await fetch("/api/internal/pipelines", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, addItem: { title } }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Pipelines</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Recurring content automation: load a queue of content items, pick platforms and a
            schedule, and the pipeline publishes them one by one — hands-free.
          </p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn-primary">+ Create Pipeline</button>
      </div>

      <div className="mt-6 space-y-4">
        {pipelines.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-white">No pipelines yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create your first pipeline to automate a recurring posting schedule.
            </p>
          </div>
        )}
        {pipelines.map((p) => {
          const pending = p.items.filter((i) => i.status === "pending").length;
          // The quick "+ Item" adds a text item; only offer it where text works.
          const textOk = p.platforms.length > 0 && p.platforms.every((pl) => PLATFORM_MAP[pl]?.supports.includes("text"));
          return (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{p.name}</h2>
                <StatusBadge status={p.status} />
                {p.loop && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">↻ loop</span>}
                <span className="text-xs text-slate-400">profile: {p.profile}</span>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => action(p.id, "run-now")} className="btn-secondary px-3 py-1 text-xs" disabled={pending === 0}>▶ Run now</button>
                  <button onClick={() => action(p.id, p.status === "active" ? "pause" : "resume")} className="btn-secondary px-3 py-1 text-xs">
                    {p.status === "active" ? "⏸ Pause" : "▶ Resume"}
                  </button>
                  <button
                    onClick={() => addItem(p.id)}
                    disabled={!textOk}
                    title={textOk ? "Add a text item" : "This pipeline's platforms need media — add media items in the create wizard"}
                    className="btn-secondary px-3 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Text item
                  </button>
                  <button onClick={() => remove(p.id, p.name)} className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer">
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  {p.platforms.map((pl) => (
                    <PlatformIcon key={pl} platform={pl} size={14} />
                  ))}
                </span>
                <span>{p.activeDays.map((d) => d.toUpperCase()).join(" ")} at {p.slotTimes.join(", ")} ({p.timezone})</span>
                <span>{pending} pending / {p.items.length} items</span>
                {p.lastRunAt && <span>last run {new Date(p.lastRunAt).toLocaleString()}</span>}
              </div>
              {p.items.length > 0 && (
                <ol className="mt-3 space-y-1.5">
                  {p.items.map((i, idx) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
                      <span className="w-6 text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-300">
                        {i.type}
                        {i.type !== "text" && i.mediaCount > 0 && ` · ${i.mediaCount}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{i.title || i.description || "(untitled)"}</span>
                      <StatusBadge status={i.status === "published" ? "published" : "pending"} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowWizard(false)}>
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Pipeline</h2>
              <span className="text-xs text-slate-400">Step {step} of 3</span>
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

            {step === 1 && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="label" htmlFor="pname">Pipeline name</label>
                  <input id="pname" className="input" placeholder="e.g. Daily course promos" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <span className="label">Profile</span>
                  <Select
                    ariaLabel="Profile"
                    value={profileId}
                    onChange={(v) => { setProfileId(v); setPlatforms([]); }}
                    options={profiles.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </div>
                <div>
                  <span className="label">Platforms</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile?.platforms ?? []).map((pl) => (
                      <button
                        key={pl}
                        onClick={() => setPlatforms((s) => (s.includes(pl) ? s.filter((x) => x !== pl) : [...s, pl]))}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          platforms.includes(pl)
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <PlatformIcon platform={pl} size={13} /> {PLATFORM_MAP[pl]?.name}
                      </button>
                    ))}
                    {(profile?.platforms ?? []).length === 0 && (
                      <p className="text-xs text-slate-400">No connected accounts on this profile.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mt-4 space-y-4">
                <div>
                  <span className="label">Active days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setActiveDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase cursor-pointer ${
                          activeDays.includes(d) ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="ptimes">Posting times (comma-separated, 24h)</label>
                  <input id="ptimes" className="input" placeholder="10:00, 15:30" value={slotTimes} onChange={(e) => setSlotTimes(e.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Times in your timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="accent-emerald-600" />
                  Loop — restart from the first item when the queue is exhausted
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4">
                <span className="label">Content items (published in order)</span>
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                        {items.length > 1 && (
                          <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-xs text-red-500 cursor-pointer">Remove</button>
                        )}
                      </div>

                      <input
                        className="input mt-1"
                        placeholder="Title (emoji welcome 🚀)"
                        value={item.title}
                        onChange={(e) => patchItem(i, { title: e.target.value })}
                      />
                      <textarea
                        className="input mt-2 min-h-14"
                        placeholder="Description / caption"
                        value={item.description}
                        onChange={(e) => patchItem(i, { description: e.target.value })}
                      />

                      {platforms.length > 1 && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.customize}
                            onChange={(e) => patchItem(i, { customize: e.target.checked })}
                            className="accent-emerald-600"
                          />
                          Different content per platform
                        </label>
                      )}

                      {!item.customize ? (
                        <>
                          {/* Base content — same for every platform */}
                          <div className="mt-2 inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                            {ITEM_TYPE_LABELS.filter((t) => allowedTypes.includes(t.value)).map((t) => (
                              <button
                                key={t.value}
                                onClick={() => patchItem(i, { type: t.value })}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                  effType(item) === t.value
                                    ? "bg-emerald-600 text-white"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          {i === 0 && textBlockedBy.length > 0 && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              Text posts aren&apos;t available for {textBlockedBy.map((p) => PLATFORM_MAP[p]?.name ?? p).join(", ")} —
                              they need photos or video.
                            </p>
                          )}
                          {effType(item) !== "text" && (
                            <div className="mt-2">
                              <MediaEditor
                                kind={effType(item) === "video" ? "video" : "photos"}
                                value={item.media}
                                onChange={(v) => patchItem(i, { media: v })}
                                onError={setError}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {platforms.map((pl) => {
                            const o = overrideFor(item, pl);
                            const pts = typesFor(pl);
                            return (
                              <div key={pl} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                                <div className="flex items-center gap-1.5">
                                  <PlatformIcon platform={pl} size={14} />
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{PLATFORM_MAP[pl]?.name ?? pl}</span>
                                  <div className="ml-auto inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                                    {ITEM_TYPE_LABELS.filter((t) => pts.includes(t.value)).map((t) => (
                                      <button
                                        key={t.value}
                                        onClick={() => patchOverride(i, pl, { type: t.value })}
                                        className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                                          o.type === t.value
                                            ? "bg-emerald-600 text-white"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        }`}
                                      >
                                        {t.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {o.type !== "text" && (
                                  <div className="mt-2">
                                    <MediaEditor
                                      kind={o.type === "video" ? "video" : "photos"}
                                      value={o.media}
                                      onChange={(v) => patchOverride(i, pl, { media: v })}
                                      onError={setError}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Instagram, TikTok and Facebook fetch media from a public URL — set{" "}
                  <code className="font-mono">PUBLIC_BASE_URL</code> so uploaded files are reachable.
                </p>
                <button
                  onClick={() => setItems([...items, { type: "text", title: "", description: "", media: { media: [], urls: "" }, customize: false, perPlatform: {} }])}
                  className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  + Add another item
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button onClick={() => (step === 1 ? setShowWizard(false) : setStep(step - 1))} className="btn-secondary">
                {step === 1 ? "Cancel" : "← Back"}
              </button>
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && (!name || platforms.length === 0)}
                  className="btn-primary"
                >
                  Next →
                </button>
              ) : (
                <button onClick={create} disabled={busy} className="btn-primary">
                  {busy ? "Creating…" : "Create Pipeline"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
