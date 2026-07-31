import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getPlan } from "@/lib/plans";
import { getStripe, isBillingConfigured, isPaidPlan } from "@/lib/billing";

// POST — { plan } change the caller's plan.
//
// This route can only ever move an account DOWN to the free plan. Upgrades are
// entitlements granted by Stripe after money moves, so they arrive through
// /api/stripe/webhook and nowhere else. Previously this endpoint wrote
// `account.plan` straight from the request body, which let any signed-in user
// grant themselves the top tier with one curl, and minted a "paid" invoice for
// a payment that never happened.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const requested = String(body.plan ?? "");
  const plan = getPlan(requested);

  if (isPaidPlan(plan.id)) {
    return NextResponse.json(
      {
        success: false,
        error: `Switching to ${plan.name} requires payment. Start a checkout session at /api/internal/billing/checkout.`,
      },
      { status: 402 }
    );
  }

  const account = await db.account.findUnique({ where: { id: auth } });
  if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });

  // Cancel at period end rather than immediately: they paid through the end of
  // the cycle, so they keep the quota they bought. The webhook flips `plan` to
  // free when Stripe actually ends the subscription.
  if (account.stripeSubscriptionId && isBillingConfigured()) {
    try {
      await getStripe().subscriptions.update(account.stripeSubscriptionId, { cancel_at_period_end: true });
      await db.account.update({ where: { id: auth }, data: { cancelAtPeriodEnd: true } });
      await db.notification.create({
        data: {
          accountId: auth,
          kind: "success",
          message: `Subscription set to cancel at the end of the current period. You keep ${getPlan(account.plan).name} until then.`,
        },
      });
      return NextResponse.json({ success: true, plan: account.plan, cancel_at_period_end: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: `Could not cancel the Stripe subscription: ${message}` },
        { status: 502 }
      );
    }
  }

  // No live subscription — nothing to cancel, so the downgrade is immediate.
  await db.account.update({
    where: { id: auth },
    data: { plan: "free", planInterval: "monthly", cancelAtPeriodEnd: false },
  });
  await db.notification.create({
    data: { accountId: auth, kind: "success", message: "Plan changed to Free" },
  });
  return NextResponse.json({ success: true, plan: "free" });
}
