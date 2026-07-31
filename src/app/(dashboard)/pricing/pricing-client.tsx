"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PLAN_PRICING, PlanId } from "@/lib/plans";
import { redirectToStripe } from "@/lib/stripe-redirect";

type Subscription = {
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
};

type Usage = { uploadsUsed: number; uploadsQuota: number; ffmpegUsed: number; ffmpegQuota: number };

export function PricingClient({
  currentPlan,
  currentInterval,
  checkoutResult,
  billingConfigured,
  subscription,
  usage,
}: {
  currentPlan: string;
  currentInterval: string;
  checkoutResult: string | null;
  billingConfigured: boolean;
  subscription: Subscription;
  usage: Usage;
}) {
  const router = useRouter();
  const [interval, setInterval_] = useState<"monthly" | "yearly">(currentInterval === "yearly" ? "yearly" : "monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Paid plans are entitlements Stripe grants after payment — this only opens
  // checkout. The plan itself changes when the webhook confirms the charge.
  async function subscribe(plan: string) {
    setError(null);
    if (!billingConfigured) {
      setError("Billing is not configured on this deployment — STRIPE_SECRET_KEY is not set.");
      return;
    }
    setBusy(plan);
    try {
      const res = await fetch("/api/internal/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || `Could not start checkout (HTTP ${res.status}).`);
        setBusy(null);
        return;
      }
      redirectToStripe(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the billing service.");
      setBusy(null);
    }
  }

  async function downgradeToFree() {
    const msg = subscription.status
      ? "Cancel your subscription? You keep your current plan until the end of the paid period, then move to Free."
      : "Switch to the Free plan?";
    if (!window.confirm(msg)) return;
    setError(null);
    setBusy("free");
    try {
      const res = await fetch("/api/internal/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || `Could not change plan (HTTP ${res.status}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the billing service.");
    }
    setBusy(null);
    router.refresh();
  }

  async function openPortal() {
    setError(null);
    setBusy("portal");
    try {
      const res = await fetch("/api/internal/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || `Could not open the billing portal (HTTP ${res.status}).`);
        setBusy(null);
        return;
      }
      redirectToStripe(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the billing service.");
      setBusy(null);
    }
  }

  const free = PLANS[0];
  const paid = PLANS.slice(1);
  const currentPlanName = PLANS.find((p) => p.id === currentPlan)?.name ?? "Free";

  return (
    <div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Pricing</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900 dark:text-white">
          Plans designed for <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">your success</span>
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">From solo creators to agencies managing hundreds of accounts.</p>

        <div className="mt-6 inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInterval_(i)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors cursor-pointer ${
                interval === i ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {i}
              {i === "yearly" && <span className="rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-bold text-red-500">SAVE 40%</span>}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
          <span>🛡 15-day money-back</span>
          <span>🔒 Secure payments by Stripe</span>
          <span>✅ Official APIs · no scraping</span>
        </div>
      </div>

      {checkoutResult === "success" && (
        <div className="mt-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-300">
          Payment received — thank you. Your plan updates as soon as Stripe confirms the subscription, usually within
          a few seconds. Refresh if the tier below still looks stale.
        </div>
      )}
      {checkoutResult === "cancelled" && (
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
          Checkout cancelled — you have not been charged and your plan is unchanged.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {!billingConfigured && (
        <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>Billing is not configured on this deployment.</strong> Paid plans cannot be purchased until
          <code className="mx-1 font-mono text-xs">STRIPE_SECRET_KEY</code> and
          <code className="mx-1 font-mono text-xs">STRIPE_WEBHOOK_SECRET</code> are set.
        </div>
      )}

      {/* Usage on the current plan */}
      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Your usage this cycle
              <span className="ml-2 rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">
                {currentPlanName}
              </span>
            </h2>
            {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Cancels on {new Date(subscription.currentPeriodEnd).toLocaleDateString()} — you keep this plan until then.
              </p>
            )}
            {!subscription.cancelAtPeriodEnd && subscription.status === "past_due" && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Payment is past due — update your card to restore your plan.
              </p>
            )}
          </div>
          {subscription.hasCustomer && (
            <button onClick={openPortal} disabled={busy !== null} className="btn-secondary text-sm">
              {busy === "portal" ? "Opening…" : "Manage billing →"}
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Uploads", used: usage.uploadsUsed, quota: usage.uploadsQuota, unit: "" },
            { label: "FFmpeg minutes", used: usage.ffmpegUsed, quota: usage.ffmpegQuota, unit: " min" },
          ].map((m) => {
            const pct = m.quota > 0 ? Math.min(100, (m.used / m.quota) * 100) : 0;
            const atLimit = m.used >= m.quota;
            return (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{m.label}</span>
                  <span>
                    {m.used.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {m.quota.toLocaleString()}
                    {m.unit}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Free plan bar */}
      <div className="card mt-8 flex flex-wrap items-center justify-around gap-4 p-5">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
          <span>
            <span className="block text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Free plan</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white">Free</span>
          </span>
        </span>
        {[["1", "profile"], [String(free.uploadsPerMonth), "uploads / month"], ["22", "platforms"]].map(([v, label]) => (
          <span key={label} className="text-center">
            <span className="block text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{v}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          </span>
        ))}
        {currentPlan !== "free" ? (
          <button onClick={downgradeToFree} disabled={busy !== null} className="btn-secondary text-sm">
            {busy === "free" ? "Cancelling…" : subscription.status ? "Cancel subscription" : "Downgrade"}
          </button>
        ) : (
          <span className="rounded-full bg-green-50 dark:bg-green-950 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">✓ Current plan</span>
        )}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {paid.map((plan) => {
          const pricing = PLAN_PRICING[plan.id as PlanId];
          const monthly = interval === "yearly" ? Math.round(pricing.annualTotal / 12) : pricing.monthly;
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative card p-6 ${plan.popular ? "border-2 border-emerald-500" : ""}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  ★ Most popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-4 rounded-full bg-green-100 dark:bg-green-950 border border-green-300 dark:border-green-800 px-2.5 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-400">
                  ✓ Current plan
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Plan</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{plan.name}</h2>
              <p className="mt-2 min-h-10 text-sm text-slate-500 dark:text-slate-400">{plan.blurb}</p>
              <p className="mt-4">
                <span className="align-top text-lg text-slate-400">$</span>
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">{monthly}</span>
                <span className="text-sm text-slate-400"> / month</span>
              </p>
              {interval === "yearly" && (
                <p className="mt-1 text-xs text-slate-400">
                  ${pricing.annualTotal} billed annually{" "}
                  <span className="rounded bg-green-50 dark:bg-green-950 px-1.5 py-0.5 font-semibold text-green-600 dark:text-green-400">
                    Save ${pricing.saveYr}/yr
                  </span>
                </p>
              )}
              <button
                onClick={() => subscribe(plan.id)}
                disabled={isCurrent || busy !== null || !billingConfigured}
                className={`${plan.popular ? "btn-primary" : "btn-secondary"} mt-5 w-full py-2.5`}
              >
                {isCurrent
                  ? "Current plan"
                  : busy === plan.id
                    ? "Opening checkout…"
                    : subscription.status
                      ? "Change plan →"
                      : "Subscribe →"}
              </button>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">What&apos;s included</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li><strong className="text-emerald-600 dark:text-emerald-400 text-lg">{plan.profiles}</strong> profiles</li>
                <li>{plan.uploadsPerMonth.toLocaleString()} uploads / month</li>
                <li>{plan.ffmpegMinutes.toLocaleString()} FFmpeg minutes</li>
                <li>{plan.team > 0 ? `${plan.team} team seats` : "No team seats"}</li>
                <li>All 22 platforms</li>
                <li>Analytics, scheduling &amp; pipelines</li>
              </ul>
              <p className="mt-3 text-xs text-slate-400">Each profile links 1 account per platform</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
