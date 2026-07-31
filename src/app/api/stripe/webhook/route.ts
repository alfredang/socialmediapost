import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import {
  getStripe,
  getWebhookSecret,
  intervalFromSubscription,
  planForStatus,
  planIdFromSubscription,
} from "@/lib/billing";

// Stripe webhook — the ONLY writer of `account.plan` for paid tiers, and the
// only creator of Invoice rows. Everything here runs on a signature-verified
// payload; an unsigned or mis-signed request is rejected before any DB access.
export const runtime = "nodejs";

async function accountIdFor(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.accountId;
  if (fromMetadata) return fromMetadata;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const account = await db.account.findUnique({ where: { stripeCustomerId: customerId } });
  return account?.id ?? null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const accountId = await accountIdFor(sub);
  if (!accountId) return;

  const planId = planIdFromSubscription(sub);
  if (!planId) return;

  // `plan` is what the account is entitled to right now. A subscription that is
  // past_due or canceled entitles them to nothing beyond the free tier.
  const effectivePlan = planForStatus(planId, sub.status);
  const periodEnd = sub.items.data[0]?.current_period_end;

  await db.account.update({
    where: { id: accountId },
    data: {
      plan: effectivePlan,
      planInterval: intervalFromSubscription(sub),
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}

async function recordInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const account = await db.account.findUnique({ where: { stripeCustomerId: customerId } });
  if (!account) return;

  // Stripe's own invoice number is the customer-facing document number; using it
  // (instead of a random one) means our table matches what Stripe shows them,
  // and replayed webhooks update rather than duplicate.
  const number = invoice.number ?? invoice.id ?? `INV-${Date.now()}`;
  const data = {
    accountId: account.id,
    number,
    total: (invoice.amount_paid || invoice.total || 0) / 100,
    currency: invoice.currency ?? "usd",
    status: invoice.status === "paid" ? "paid" : (invoice.status ?? "open"),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
  };

  if (!invoice.id) return;
  await db.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: { ...data, stripeInvoiceId: invoice.id },
    update: data,
  });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ success: false, error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // The raw body is required — parsing it first would invalidate the signature.
    const raw = await req.text();
    event = await getStripe().webhooks.constructEventAsync(raw, signature, getWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const accountId = session.metadata?.accountId ?? session.client_reference_id;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (accountId && subId) {
          const sub = await getStripe().subscriptions.retrieve(subId);
          // Checkout metadata is the most reliable link back to the account, so
          // stamp it on the subscription before syncing from it.
          if (!sub.metadata?.accountId) {
            await getStripe().subscriptions.update(subId, {
              metadata: {
                accountId,
                planId: session.metadata?.planId ?? "",
                interval: session.metadata?.interval ?? "",
              },
            });
            sub.metadata = { ...sub.metadata, accountId, planId: session.metadata?.planId ?? "" };
          }
          await syncSubscription(sub);
          const planName = getPlan(session.metadata?.planId ?? "").name;
          await db.notification.create({
            data: { accountId, kind: "success", message: `Subscription active — you're on the ${planName} plan.` },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        if (event.type === "customer.subscription.deleted") {
          const accountId = await accountIdFor(sub);
          if (accountId) {
            await db.account.update({
              where: { id: accountId },
              data: {
                plan: "free",
                subscriptionStatus: "canceled",
                stripeSubscriptionId: null,
                cancelAtPeriodEnd: false,
                currentPeriodEnd: null,
              },
            });
            await db.notification.create({
              data: { accountId, kind: "info", message: "Subscription ended — your account is now on the Free plan." },
            });
          }
        } else {
          await syncSubscription(sub);
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await recordInvoice(invoice);
        if (event.type === "invoice.payment_failed") {
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          const account = customerId
            ? await db.account.findUnique({ where: { stripeCustomerId: customerId } })
            : null;
          if (account) {
            await db.notification.create({
              data: {
                accountId: account.id,
                kind: "error",
                message: "Payment failed — update your card to keep your plan active.",
              },
            });
          }
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        break;
    }
  } catch (err) {
    // A 500 tells Stripe to retry, which is what we want for transient DB errors.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe] handler failed for ${event.type}:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
