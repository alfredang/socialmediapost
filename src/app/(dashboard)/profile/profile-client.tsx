"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function Card({ icon, title, desc, children }: { icon: string; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
      <div className="flex items-start gap-4 min-w-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-slate-900 dark:text-white">{title}</span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">{desc}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

export function ProfileClient({
  email,
  plan,
  calendarWeekStart,
  webhookUrl,
}: {
  email: string;
  plan: { id: string; name: string };
  calendarWeekStart: string;
  webhookUrl: string;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(calendarWeekStart);
  const [webhook, setWebhook] = useState(webhookUrl);
  const [webhookSaved, setWebhookSaved] = useState(false);

  async function patch(data: object) {
    await fetch("/api/internal/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function changeEmail() {
    const next = window.prompt("New email address", email);
    if (!next || next === email) return;
    await patch({ email: next });
    router.refresh();
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your entire account? This removes all profiles, posts and analytics.")) return;
    if (!window.confirm("Are you absolutely sure? This cannot be undone.")) return;
    await fetch("/api/internal/account", { method: "DELETE" });
    window.location.href = "/";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">My Profile</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage your account details, subscription, and billing — all in one place.
        </p>
      </div>

      <section className="card p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {email.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{email}</p>
            <span className="mt-1 inline-block rounded-md bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">User</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Welcome to your <strong>profile page</strong> on <strong>SocialPost</strong>. View your
          account details and manage your subscription. Billing here is simulated for the demo —
          switching plans generates real invoices in your account.
        </p>
      </section>

      <Card icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M16 13H8M16 17H8M10 9H8" title="Invoices & Billing" desc="View your legally valid invoices or update your plan.">
        <Link href="/profile/invoices" className="btn-primary">📄 View Invoices</Link>
      </Card>

      <Card icon="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" title="Calendar Preferences" desc="Choose which day your calendar week starts on.">
        <select
          className="input w-36"
          value={week}
          onChange={async (e) => {
            setWeek(e.target.value);
            await patch({ calendarWeekStart: e.target.value });
          }}
          aria-label="Week start day"
        >
          <option value="monday">Monday</option>
          <option value="sunday">Sunday</option>
        </select>
      </Card>

      <section className="card p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Account Details</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your email and current plan information.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="label">Email address</span>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{email}</span>
                  <button onClick={changeEmail} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer">Change</button>
                </div>
              </div>
              <div>
                <span className="label">Current plan</span>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{plan.name}</span>
                  <Link href="/pricing" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">View plans</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Subscription</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your subscription, add extra profiles, or cancel anytime.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/pricing" className="btn-primary text-xs">💳 Manage Subscription</Link>
              <Link href="/pricing" className="btn-secondary text-xs">⇄ Change Plan</Link>
              <Link href="/users" className="btn-secondary text-xs">👥 Manage Extra Profiles</Link>
              <button onClick={() => window.alert("Cancellation is simulated in this demo — switch to the Free plan instead.")} className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer">
                ⊘ Cancel Subscription
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Want to unlock more features? Check out our <Link href="/pricing" className="text-emerald-600 dark:text-emerald-400 underline">pricing plans</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Webhook</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              We&apos;ll POST post.completed events (status + per-platform results) to this URL.
            </p>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="https://your-app.com/webhooks/socialpost" value={webhook} onChange={(e) => setWebhook(e.target.value)} />
              <button
                onClick={async () => {
                  await patch({ webhookUrl: webhook });
                  setWebhookSaved(true);
                  setTimeout(() => setWebhookSaved(false), 2000);
                }}
                className="btn-primary shrink-0"
              >
                {webhookSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <Card icon="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z" title="Leave a review" desc="Share your experience and help us improve SocialPost.">
        <button onClick={() => window.alert("Thanks! ⭐️⭐️⭐️⭐️⭐️")} className="btn-primary">⭐ Leave a review</button>
      </Card>

      <Card icon="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" title="Sign out" desc="End your session on this device.">
        <button onClick={logout} className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer">
          ⎋ Logout
        </button>
      </Card>

      <section className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-6">
        <h2 className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">⚠ Danger zone</h2>
        <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">Irreversible actions affecting your entire account.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900 p-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Delete my account</p>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              Your data will be permanently removed, and you will be unsubscribed from all our emails.
            </p>
          </div>
          <button onClick={deleteAccount} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer">
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
