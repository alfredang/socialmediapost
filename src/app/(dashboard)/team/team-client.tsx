"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
}

export function TeamClient({ seats, planName, invites }: { seats: number; planName: string; invites: Invite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const gated = seats === 0;

  async function invite() {
    setError(null);
    const res = await fetch("/api/internal/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!data.success) return setError(data.error);
    setEmail("");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/internal/team?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Team Management</h1>
      </div>
      <p className="mt-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">
        Collaborate by inviting members to your account or manage accounts shared with you.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></svg>
              Invite Team Members
            </h2>
            <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {invites.length} / {seats} Used
            </span>
          </div>

          {gated ? (
            <div className="mt-5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <h3 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">Upgrade to Collaborate</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Team collaboration is available on Professional plans and above. Invite colleagues to
                manage your social media together. (Current plan: {planName})
              </p>
              <Link href="/pricing" className="btn-primary mt-5">View Plans &amp; Upgrade</Link>
            </div>
          ) : (
            <>
              {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
              <div className="mt-4 flex gap-2">
                <input className="input" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} />
                <button onClick={invite} disabled={!email} className="btn-primary shrink-0">Invite</button>
              </div>
              <ul className="mt-4 space-y-2">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">{i.email}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={i.status} />
                      <button onClick={() => remove(i.id)} aria-label="Remove invite" className="text-slate-300 hover:text-red-500 cursor-pointer">✕</button>
                    </span>
                  </li>
                ))}
                {invites.length === 0 && <li className="py-4 text-center text-sm text-slate-400">No invites yet.</li>}
              </ul>
            </>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white">Shared With Me</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Accounts you&apos;ve been invited to manage.</p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>
            </span>
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">No shared accounts</p>
            <p className="text-sm text-slate-400">When someone invites you, it will appear here.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
