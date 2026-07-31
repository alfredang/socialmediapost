import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getPlan, PlanId } from "@/lib/plans";
import { appBaseUrl } from "@/lib/base-url";
import { getStripe, isPaidPlan, lineItemFor, normalizeInterval } from "@/lib/billing";

// POST — { plan, interval } → { url } a Stripe Checkout session to subscribe.
// Creating the session grants nothing on its own; the plan only changes once
// Stripe confirms payment through the webhook.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const plan = getPlan(String(body.plan ?? ""));
  const interval = normalizeInterval(body.interval);

  if (!isPaidPlan(plan.id)) {
    return NextResponse.json(
      { success: false, error: "Checkout is only for paid plans. Use /api/internal/plan to move to Free." },
      { status: 400 }
    );
  }

  const account = await db.account.findUnique({ where: { id: auth } });
  if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });

  try {
    const stripe = getStripe();
    const base = appBaseUrl(new URL(req.url).origin);

    // Reuse the Stripe customer across checkouts so one account never ends up
    // with several customers (and several parallel subscriptions).
    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: account.email,
        name: account.name ?? undefined,
        metadata: { accountId: account.id },
      });
      customerId = customer.id;
      await db.account.update({ where: { id: account.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: account.id,
      line_items: [lineItemFor(plan.id as PlanId, interval)],
      // Carried onto the subscription so the webhook knows which plan was
      // bought without inferring it from the amount.
      subscription_data: { metadata: { accountId: account.id, planId: plan.id, interval } },
      metadata: { accountId: account.id, planId: plan.id, interval },
      success_url: `${base}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ success: false, error: "Stripe did not return a checkout URL" }, { status: 502 });
    }
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
