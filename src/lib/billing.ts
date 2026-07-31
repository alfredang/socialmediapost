import Stripe from "stripe";
import { PLAN_PRICING, PlanId, getPlan } from "./plans";

// Billing is real money. Every helper here either works against a configured
// Stripe account or throws — there is no offline/simulated mode, because a
// "successful" plan change that never charged anyone is worse than an error.

let client: Stripe | null = null;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — refusing to process billing. Set it to your Stripe secret key (sk_live_… or sk_test_…)."
    );
  }
  if (!client) client = new Stripe(key);
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set — refusing to trust webhook payloads. Copy it from `stripe listen` or the Stripe dashboard endpoint."
    );
  }
  return secret;
}

export type BillingInterval = "monthly" | "yearly";

export function normalizeInterval(value: unknown): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

// Prices are built inline from PLAN_PRICING rather than referencing Price IDs
// created in the Stripe dashboard. That keeps src/lib/plans.ts the single
// source of truth for what a plan costs — the pricing page and the amount
// charged can never disagree.
export function lineItemFor(planId: PlanId, interval: BillingInterval): Stripe.Checkout.SessionCreateParams.LineItem {
  const plan = getPlan(planId);
  const pricing = PLAN_PRICING[planId];
  const amount = interval === "yearly" ? pricing.annualTotal : pricing.monthly;
  if (amount <= 0) {
    throw new Error(`Plan "${planId}" is not a paid plan — it must not go through checkout.`);
  }
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: Math.round(amount * 100),
      recurring: { interval: interval === "yearly" ? "year" : "month" },
      product_data: {
        name: `SocialPost ${plan.name}`,
        description: `${plan.uploadsPerMonth.toLocaleString()} uploads/month · ${plan.profiles} profiles · ${plan.ffmpegMinutes.toLocaleString()} FFmpeg minutes`,
      },
    },
  };
}

export function isPaidPlan(planId: string): boolean {
  const pricing = PLAN_PRICING[planId as PlanId];
  return Boolean(pricing) && pricing.monthly > 0;
}

// Stripe is authoritative about which plan an account is on. The plan id rides
// on subscription metadata so we never have to reverse-engineer it from an
// amount, which would break the moment prices change.
export function planIdFromSubscription(sub: Stripe.Subscription): PlanId | null {
  const raw = sub.metadata?.planId;
  if (raw && PLAN_PRICING[raw as PlanId]) return raw as PlanId;
  return null;
}

export function intervalFromSubscription(sub: Stripe.Subscription): BillingInterval {
  const recurring = sub.items.data[0]?.price?.recurring;
  return recurring?.interval === "year" ? "yearly" : "monthly";
}

// A subscription only entitles an account to its plan while Stripe considers it
// live. Anything else (past_due, unpaid, canceled) falls back to free so an
// unpaid account cannot keep a paid quota.
export function planForStatus(planId: PlanId, status: Stripe.Subscription.Status): PlanId {
  return status === "active" || status === "trialing" ? planId : "free";
}
