"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PLAN_PRICING, PlanId } from "@/lib/plans";

export function PricingClient({ currentPlan, currentInterval }: { currentPlan: string; currentInterval: string }) {
  const router = useRouter();
  const [interval, setInterval_] = useState<"monthly" | "yearly">(currentInterval === "yearly" ? "yearly" : "monthly");
  const [busy, setBusy] = useState<string | null>(null);

  async function switchPlan(plan: string) {
    if (!window.confirm(`Switch to the ${plan} plan (${interval})? An invoice will be generated.`)) return;
    setBusy(plan);
    await fetch("/api/internal/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    setBusy(null);
    router.refresh();
  }

  const free = PLANS[0];
  const paid = PLANS.slice(1);

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
          <span>🔒 Secure simulated billing</span>
          <span>✅ Official APIs · no scraping</span>
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
          <button onClick={() => switchPlan("free")} className="btn-secondary text-sm">Downgrade</button>
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
                onClick={() => switchPlan(plan.id)}
                disabled={isCurrent || busy !== null}
                className={`${plan.popular ? "btn-primary" : "btn-secondary"} mt-5 w-full py-2.5`}
              >
                {isCurrent ? "Current plan" : busy === plan.id ? "Switching…" : "Switch plan →"}
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
