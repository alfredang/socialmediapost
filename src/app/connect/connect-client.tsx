"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORMS, PLATFORM_MAP } from "@/lib/platforms";

// Platforms with a real OAuth integration. A whitelabel user can only connect
// these — there is no way to "add" an account by typing a handle, because an
// account without a provider token cannot publish anything.
const OAUTH_PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok"] as const;

const STATUS_MESSAGES: Record<string, { kind: "ok" | "err"; text: string }> = {
  connected: { kind: "ok", text: "Account connected." },
  "select-page": { kind: "ok", text: "Facebook connected — ask your content manager to finish choosing a Page." },
  "enter-page-id": { kind: "ok", text: "Facebook connected — ask your content manager to finish linking your Page." },
  "not-configured": { kind: "err", text: "This platform isn't configured on this server yet." },
  denied: { kind: "err", text: "Authorization was denied." },
  failed: { kind: "err", text: "Connection failed. Please try again." },
  "invalid-state": { kind: "err", text: "That connection attempt expired. Please try again." },
  "profile-not-found": { kind: "err", text: "This connect link is no longer valid." },
};

export function ConnectClient({
  token,
  profile,
  connected,
}: {
  token: string;
  profile: string;
  connected: string[];
}) {
  const params = useSearchParams();

  // Derived during render — the OAuth result lives in the URL, so there is no
  // state to synchronise.
  const platform = params.get("connected");
  const status = params.get("status");
  const base = status ? STATUS_MESSAGES[status] : undefined;
  const notice =
    platform && base
      ? { kind: base.kind, text: `${PLATFORM_MAP[platform]?.name ?? platform}: ${base.text}` }
      : null;

  // Drop the result params so a refresh doesn't replay the message.
  useEffect(() => {
    if (!platform && !status) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("connected");
    url.searchParams.delete("status");
    window.history.replaceState({}, "", url);
  }, [platform, status]);

  const available = PLATFORMS.filter((p) =>
    (OAUTH_PLATFORMS as readonly string[]).includes(p.id)
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Connect your accounts</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Link your social media accounts to profile <strong>{profile}</strong>. Your content manager
        will be able to publish on your behalf. You&apos;ll sign in with each platform directly —
        SocialPost never sees your password.
      </p>

      {notice && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-5 grid gap-2 text-left">
        {available.map((p) => {
          const isConnected = connected.includes(p.id);
          return isConnected ? (
            <span
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            >
              <PlatformIcon platform={p.id} size={16} />
              {p.name} ✓
            </span>
          ) : (
            <a
              key={p.id}
              href={`/api/auth/${p.id}?connect_token=${encodeURIComponent(token)}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40"
            >
              <PlatformIcon platform={p.id} size={16} />
              Connect {p.name}
            </a>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Other platforms aren&apos;t available to connect yet.
      </p>
    </>
  );
}
