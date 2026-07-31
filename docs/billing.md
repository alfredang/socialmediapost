# Billing — Stripe Setup Manual

How SocialPost charges for plans, and what you must configure before paid plans
work. Like every other integration, secrets go in `.env` and are read via
`process.env`.

> There is no offline or simulated billing mode. If `STRIPE_SECRET_KEY` is
> unset, checkout refuses to start and the pricing page says so — it never
> pretends a payment succeeded.

---

## 0. The rule that shapes everything

**Only the Stripe webhook may grant a paid plan.** `account.plan` is a cache of
what Stripe says the account is entitled to. No user-facing request writes it to
a paid value — `POST /api/internal/plan` can only move an account *down* to
free. If you add a new billing path, keep this property.

| Route | May write `account.plan`? |
| --- | --- |
| `POST /api/internal/billing/checkout` | No — creates a Checkout session only |
| `POST /api/internal/billing/portal` | No — redirects to Stripe's portal |
| `POST /api/internal/plan` | Only to `free` |
| `POST /api/stripe/webhook` | Yes — after signature verification |

---

## 1. Environment variables

| Variable | Where to get it | Required for |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys (`sk_test_…` / `sk_live_…`) | Checkout, portal, webhook verification |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output, or the endpoint's signing secret in the dashboard (`whsec_…`) | Webhook |
| `PUBLIC_BASE_URL` | Your public origin, no trailing slash | Checkout success/cancel redirects |

Restart the app after editing `.env` — env vars load at boot.

## 2. No Price IDs to create

Prices are built inline from `src/lib/plans.ts` (`PLAN_PRICING`) at checkout
time, so there is **nothing to set up in the Stripe dashboard's product
catalogue**. Editing a plan's price in `plans.ts` changes what the pricing page
shows and what Stripe charges, together — they cannot drift apart.

Existing subscribers keep the price they signed up at until their subscription
is changed; Stripe does not retroactively reprice.

## 3. Local development

```bash
# 1. Forward webhooks to your local app
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 2. Copy the whsec_… it prints into .env as STRIPE_WEBHOOK_SECRET, restart the app

# 3. Subscribe from /pricing using a test card
#    4242 4242 4242 4242 · any future expiry · any CVC
```

Useful triggers once the listener is running:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

## 4. Production endpoint

Add an endpoint in Stripe → Developers → Webhooks pointing at
`{PUBLIC_BASE_URL}/api/stripe/webhook`, subscribed to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. A webhook that
fails is answered with HTTP 500 so Stripe retries it.

## 5. What each event does

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Links the subscription to the account, stamps `planId` metadata, syncs the plan |
| `customer.subscription.created/updated` | Syncs plan, interval, status, period end, `cancel_at_period_end` |
| `customer.subscription.deleted` | Drops the account to free, clears the subscription |
| `invoice.paid` | Upserts an `Invoice` row with Stripe's invoice number, hosted URL and PDF |
| `invoice.payment_failed` | Records the invoice and notifies the account |

A subscription only entitles an account to its plan while its status is `active`
or `trialing` (`planForStatus` in `src/lib/billing.ts`). `past_due`, `unpaid` and
`canceled` all fall back to the free quota.

## 6. Cancellation

`POST /api/internal/plan` with `{"plan":"free"}` sets `cancel_at_period_end` on
the Stripe subscription rather than ending it immediately — the customer keeps
the quota they already paid for. The plan flips to free when Stripe sends
`customer.subscription.deleted` at the end of the period.

Customers can also cancel, change card or download receipts themselves through
the Stripe billing portal (**Manage billing** on `/profile` or `/pricing`).
