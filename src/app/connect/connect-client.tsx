"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORMS } from "@/lib/platforms";

export function ConnectClient({ token, profile }: { token: string; profile: string }) {
  const [connected, setConnected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function connect(platform: string) {
    const handle = window.prompt(`Your ${platform} handle`);
    if (!handle) return;
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, platform, handle }),
    });
    const data = await res.json();
    if (!data.success) return setError(data.error);
    setConnected([...connected, platform]);
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Connect your accounts</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Link your social media accounts to profile <strong>{profile}</strong>. Your content manager
        will be able to publish on your behalf.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2 text-left">
        {PLATFORMS.slice(0, 12).map((p) => (
          <button
            key={p.id}
            onClick={() => connect(p.id)}
            disabled={connected.includes(p.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              connected.includes(p.id)
                ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
                : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400"
            }`}
          >
            <PlatformIcon platform={p.id} size={16} />
            {connected.includes(p.id) ? `${p.name} ✓` : p.name}
          </button>
        ))}
      </div>
    </>
  );
}
