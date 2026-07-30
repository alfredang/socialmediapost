"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Select } from "@/components/Select";
import { PLATFORMS, PLATFORM_MAP, CREDENTIAL_PLATFORM_SET } from "@/lib/platforms";

// The credential field(s) each webhook/token platform needs, with where to find
// them. Keys match the /api/internal/social-accounts POST body.
interface CredField {
  key: string;
  label: string;
  placeholder: string;
  hint: string;
}
const CREDENTIAL_FIELDS: Record<string, CredField[]> = {
  discord: [
    {
      key: "webhookUrl",
      label: "Discord webhook URL",
      placeholder: "https://discord.com/api/webhooks/…",
      hint: "In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.",
    },
  ],
  slack: [
    {
      key: "webhookUrl",
      label: "Slack incoming webhook URL",
      placeholder: "https://hooks.slack.com/services/…",
      hint: "At api.slack.com/apps → Create New App → pick the \"Blank app\" option (not 'From a manifest') → choose your workspace. Open Incoming Webhooks → Toggle it On → Add New Webhook to Workspace → Pick a channel → Allow → Copy the URL. Connecting posts a test message to that channel.",
    },
  ],
  telegram: [
    {
      key: "botToken",
      label: "Bot token",
      placeholder: "123456789:AA…",
      hint: "Create a bot with @BotFather in Telegram and paste the token it gives you.",
    },
    {
      key: "chatId",
      label: "Channel / chat ID",
      placeholder: "@yourchannel or -1001234567890",
      hint: "First add the bot to your channel as an admin. Public channel? Just use its @username. Private? Forward any message from it to @userinfobot in Telegram — it replies with the numeric id (like -1001234567890).",
    },
  ],
};

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string;
  status: string;
  pageOptions?: { id: string; name: string }[]; // Facebook pending_page picker
}
interface ProfileRow {
  id: string;
  name: string;
  accounts: SocialAccount[];
}

// Platforms with a real OAuth integration; the rest are shown as coming soon.
const OAUTH_PLATFORMS = new Set(["instagram", "linkedin", "facebook", "tiktok", "youtube", "threads"]);

export function UsersClient({
  plan,
  profiles,
}: {
  plan: { id: string; name: string; profiles: number };
  profiles: ProfileRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [pageIdInput, setPageIdInput] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Credential-connect modal (webhook/token platforms — Discord, Slack, Telegram).
  const [credModal, setCredModal] = useState<{ profileId: string; platform: string } | null>(null);
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [credError, setCredError] = useState<string | null>(null);
  // Telegram "detect my channels": bot token → channels the bot can see.
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<{ id: string; title: string }[] | null>(null);

  // Surface an OAuth connect redirect result (?connected=<platform>&status=...)
  // then clean the URL.
  useEffect(() => {
    const platform = searchParams.get("connected");
    const status = searchParams.get("status");
    if (!platform || !status) return;
    const name = PLATFORM_MAP[platform]?.name ?? platform;
    const messages: Record<string, { kind: "ok" | "err"; text: string }> = {
      connected: { kind: "ok", text: `${name} account connected.` },
      "not-configured": {
        kind: "err",
        text: `${name} OAuth isn't configured — set its client ID/secret env vars and restart.`,
      },
      "select-page": { kind: "ok", text: "Facebook connected — choose which Page to publish to below." },
      "enter-page-id": {
        kind: "ok",
        text: "Facebook connected, but it didn't list your Pages — paste your Page ID below. On your Page, click the ⋯ button top-right → About this profile → Page transparency, or copy the Page's share link and use the number in it.",
      },
      denied: { kind: "err", text: `${name} authorization was denied.` },
      failed: { kind: "err", text: `${name} connection failed. Please try again.` },
      "invalid-state": { kind: "err", text: `${name} connection expired. Please try again.` },
      "profile-not-found": { kind: "err", text: "Profile not found." },
      "no-pages": {
        kind: "err",
        text: "No Facebook Pages found — the Facebook API can only post to Pages, not personal profiles.",
      },
    };
    setNotice(messages[status] ?? null);
    router.replace("/users");
    router.refresh();
  }, [searchParams, router]);

  async function addProfile() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/internal/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.success) return setError(data.error);
    setName("");
    router.refresh();
  }

  function connect(profileId: string, platform: string) {
    // OAuth platforms redirect out to the provider and come back to /users.
    window.location.href = `/api/auth/${platform}?profileId=${encodeURIComponent(profileId)}`;
  }

  function openCredModal(profileId: string, platform: string) {
    setCredModal({ profileId, platform });
    setCredFields({});
    setCredError(null);
    setDetected(null);
  }

  async function detectTelegramChats() {
    const token = credFields.botToken?.trim();
    if (!token) return;
    setDetecting(true);
    setCredError(null);
    setDetected(null);
    const res = await fetch("/api/internal/telegram/detect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ botToken: token }),
    });
    const data = await res.json();
    setDetecting(false);
    if (!data.success) return setCredError(data.error);
    setDetected(data.chats);
  }

  async function submitCred() {
    if (!credModal) return;
    const fields = CREDENTIAL_FIELDS[credModal.platform] ?? [];
    if (fields.some((f) => !credFields[f.key]?.trim())) return;
    setBusy(true);
    setCredError(null);
    const payload: Record<string, string> = { profileId: credModal.profileId, platform: credModal.platform };
    for (const f of fields) payload[f.key] = credFields[f.key].trim();
    const res = await fetch("/api/internal/social-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.success) return setCredError(data.error);
    const name = PLATFORM_MAP[credModal.platform]?.name ?? credModal.platform;
    setCredModal(null);
    setNotice({ kind: "ok", text: `${name} connected.` });
    router.refresh();
  }

  async function disconnect(id: string) {
    await fetch(`/api/internal/social-accounts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Finish a Facebook connection by picking which managed Page to publish to.
  async function selectPage(id: string, pageId: string) {
    const res = await fetch("/api/internal/social-accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, pageId }),
    });
    const data = await res.json();
    if (!data.success) return setError(data.error);
    setNotice({ kind: "ok", text: "Facebook Page connected." });
    router.refresh();
  }

  async function deleteProfile(id: string, profileName: string) {
    if (!window.confirm(`Delete profile "${profileName}" and all its posts?`)) return;
    await fetch(`/api/internal/profiles?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function share(profileName: string) {
    // Whitelabel: JWT connect-link so your own users can link their accounts
    const res = await fetch("/api/internal/share-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: profileName }),
    });
    const data = await res.json();
    if (data.success) setShareLink(data.connect_url);
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">User Management</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Create profiles to manage your social media accounts. The profile name you choose will be
        used as the <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs">user</code>{" "}
        parameter in the API. Each profile can be linked to multiple social media accounts, allowing
        you to manage different sets of accounts separately.
      </p>

      <div className="mt-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
        Want to let your own users connect their social media accounts? Generate a shareable
        connect link with the <strong>Share</strong> button — that&apos;s the whitelabel profile API in action.
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      {notice && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}
      {shareLink && (
        <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-800 dark:text-green-300 break-all">
          Share this connect link with your user (valid 24h): <code className="font-mono text-xs">{shareLink}</code>
        </div>
      )}

      <div className="mt-6">
        <label className="label" htmlFor="new-profile">Add New Profile</label>
        <div className="flex gap-2">
          <input
            id="new-profile"
            className="input"
            placeholder="e.g. business_account, personal11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProfile()}
          />
          <button onClick={addProfile} disabled={busy || !name} className="btn-primary shrink-0">
            + Add Profile
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Allowed characters: letters, numbers, underscores, hyphens, and @
        </p>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registered Users</h2>
        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {profiles.length}/{plan.profiles} Profiles ({plan.name} plan)
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-3 pr-4">Profile</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Social Accounts</th>
              <th className="py-3">Whitelabel</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                  No profiles yet — add your first profile above.
                </td>
              </tr>
            )}
            {profiles.map((p) => {
              const connected = new Map(p.accounts.map((a) => [a.platform, a]));
              // Connectable platforms (OAuth, credential, or already linked) first;
              // "Coming soon" ones sink to the bottom. Stable sort keeps registry
              // order within each group.
              const isAvailable = (pl: (typeof PLATFORMS)[number]) =>
                OAUTH_PLATFORMS.has(pl.id) || CREDENTIAL_PLATFORM_SET.has(pl.id) || connected.has(pl.id);
              const orderedPlatforms = [...PLATFORMS].sort(
                (a, b) => Number(isAvailable(b)) - Number(isAvailable(a))
              );
              return (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <button
                        onClick={() => deleteProfile(p.id, p.name)}
                        aria-label={`Delete profile ${p.name}`}
                        className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-1">
                      {p.accounts.slice(0, 6).map((a) => (
                        <PlatformIcon key={a.id} platform={a.platform} size={14} />
                      ))}
                      {p.accounts.length === 0 && <span className="text-xs text-slate-400">No accounts</span>}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {orderedPlatforms.map((pl) => {
                        const acc = connected.get(pl.id);
                        const credential = CREDENTIAL_PLATFORM_SET.has(pl.id);
                        const unavailable = !OAUTH_PLATFORMS.has(pl.id) && !credential && !acc;
                        if (acc?.status === "pending_page") {
                          // Facebook OAuth done, Page not chosen yet — inline picker.
                          return (
                            <span
                              key={pl.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5"
                            >
                              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                                <PlatformIcon platform={pl.id} size={15} />
                                {(acc.pageOptions?.length ?? 0) > 0 ? (
                                  <Select
                                    className="w-full min-w-0"
                                    ariaLabel="Choose a Facebook Page"
                                    placeholder="Choose a Page…"
                                    value=""
                                    onChange={(v) => v && selectPage(acc.id, v)}
                                    options={(acc.pageOptions ?? []).map((pg) => ({ value: pg.id, label: pg.name }))}
                                    triggerClassName="flex w-full min-w-0 items-center justify-between gap-1 cursor-pointer bg-transparent text-xs font-medium text-amber-700 dark:text-amber-300 outline-none"
                                  />
                                ) : (
                                  // Meta didn't list any Pages — connect by Page ID.
                                  <span className="flex w-full min-w-0 items-center gap-1">
                                    <input
                                      value={pageIdInput}
                                      onChange={(e) => setPageIdInput(e.target.value)}
                                      onKeyDown={(e) =>
                                        e.key === "Enter" && pageIdInput.trim() && selectPage(acc.id, pageIdInput.trim())
                                      }
                                      placeholder="Page ID…"
                                      aria-label="Facebook Page ID"
                                      className="w-full min-w-0 bg-transparent text-xs font-medium text-amber-700 dark:text-amber-300 outline-none placeholder-amber-400 dark:placeholder-amber-600"
                                    />
                                    <button
                                      onClick={() => selectPage(acc.id, pageIdInput.trim())}
                                      disabled={!pageIdInput.trim()}
                                      className="shrink-0 rounded bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 disabled:opacity-40 cursor-pointer transition-colors hover:bg-amber-200 dark:hover:bg-amber-800"
                                    >
                                      Link
                                    </button>
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => disconnect(acc.id)}
                                aria-label={`Disconnect ${pl.name}`}
                                className="text-amber-300 hover:text-red-500 text-sm font-bold transition-colors cursor-pointer"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        }
                        return acc ? (
                          <span
                            key={pl.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <PlatformIcon platform={pl.id} size={15} />
                              <span className="truncate text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                {acc.displayName}
                              </span>
                            </span>
                            <button
                              onClick={() => disconnect(acc.id)}
                              aria-label={`Disconnect ${pl.name}`}
                              className="text-emerald-300 hover:text-red-500 text-sm font-bold transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            key={pl.id}
                            onClick={() => {
                              if (unavailable) return;
                              if (credential) openCredModal(p.id, pl.id);
                              else connect(p.id, pl.id);
                            }}
                            disabled={unavailable}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                              unavailable
                                ? "border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                                : "border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <PlatformIcon platform={pl.id} size={15} />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{pl.name}</span>
                            </span>
                            {unavailable && (
                              <span className="rounded bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                Coming soon
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-4">
                    <button onClick={() => share(p.name)} className="btn-secondary text-xs px-3 py-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                        <path d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98" />
                      </svg>
                      Share
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {credModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCredModal(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <PlatformIcon platform={credModal.platform} size={18} />
                Connect {PLATFORM_MAP[credModal.platform]?.name ?? credModal.platform}
              </h2>
              <button
                onClick={() => setCredModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {(CREDENTIAL_FIELDS[credModal.platform] ?? []).map((field, i, arr) => {
              // Reveal fields one at a time — each appears once all earlier ones
              // are filled (e.g. Telegram's chat id shows only after the token).
              const priorFilled = arr.slice(0, i).every((pf) => credFields[pf.key]?.trim());
              if (!priorFilled) return null;
              return (
                <div key={field.key} className="mt-4">
                  <label className="label" htmlFor={`cred-${field.key}`}>{field.label}</label>
                  <input
                    id={`cred-${field.key}`}
                    className="input"
                    placeholder={field.placeholder}
                    value={credFields[field.key] ?? ""}
                    onChange={(e) => setCredFields((f) => ({ ...f, [field.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && submitCred()}
                    autoFocus={i === 0}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">{field.hint}</p>
                </div>
              );
            })}

            {credModal.platform === "telegram" && !!credFields.botToken?.trim() && (
              <div className="mt-2">
                <button
                  onClick={detectTelegramChats}
                  disabled={detecting || !credFields.botToken?.trim()}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  {detecting ? "Detecting…" : "↻ Detect my channels"}
                </button>
                {detected?.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    None found — add the bot to your channel as admin, post a message there, then retry.
                  </p>
                )}
                {detected && detected.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detected.map((c) => {
                      const active = credFields.chatId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setCredFields((f) => ({ ...f, chatId: c.id }))}
                          className={`rounded-lg border px-2 py-1 text-xs cursor-pointer transition-colors ${
                            active
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {c.title} <span className="text-slate-400">{c.id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {credError && (
              <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {credError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCredModal(null)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={submitCred}
                disabled={busy || (CREDENTIAL_FIELDS[credModal.platform] ?? []).some((f) => !credFields[f.key]?.trim())}
                className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
