"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORMS } from "@/lib/platforms";

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string;
  status: string;
}
interface ProfileRow {
  id: string;
  name: string;
  accounts: SocialAccount[];
}

const UNAVAILABLE = new Set(["reddit"]);
// Platforms that connect via a real OAuth redirect instead of the simulated prompt.
const OAUTH_PLATFORMS = new Set(["instagram"]);

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
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Surface the Instagram OAuth redirect result (?ig=...) then clean the URL.
  useEffect(() => {
    const ig = searchParams.get("ig");
    if (!ig) return;
    const messages: Record<string, { kind: "ok" | "err"; text: string }> = {
      connected: { kind: "ok", text: "Instagram account connected." },
      demo: { kind: "ok", text: "Demo Instagram account connected (no OAuth credentials configured)." },
      denied: { kind: "err", text: "Instagram authorization was denied." },
      failed: { kind: "err", text: "Instagram connection failed. Please try again." },
      "invalid-state": { kind: "err", text: "Instagram connection expired. Please try again." },
      "profile-not-found": { kind: "err", text: "Profile not found." },
    };
    setNotice(messages[ig] ?? null);
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

  function connect(profileId: string, platform: string, currentName: string) {
    // Real OAuth platforms redirect out to the provider and come back to /users.
    if (OAUTH_PLATFORMS.has(platform)) {
      window.location.href = `/api/auth/${platform}?profileId=${encodeURIComponent(profileId)}`;
      return;
    }
    return connectSimulated(profileId, platform, currentName);
  }

  async function connectSimulated(profileId: string, platform: string, currentName: string) {
    const handle = window.prompt(`Connect ${platform}: enter the account handle`, currentName);
    if (handle === null) return;
    const res = await fetch("/api/internal/social-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, platform, handle }),
    });
    const data = await res.json();
    if (!data.success) return setError(data.error);
    router.refresh();
  }

  async function disconnect(id: string) {
    await fetch(`/api/internal/social-accounts?id=${id}`, { method: "DELETE" });
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
                      {PLATFORMS.map((pl) => {
                        const acc = connected.get(pl.id);
                        const unavailable = UNAVAILABLE.has(pl.id) && !acc;
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
                            onClick={() => !unavailable && connect(p.id, pl.id, p.name)}
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
                                Unavailable
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
    </div>
  );
}
