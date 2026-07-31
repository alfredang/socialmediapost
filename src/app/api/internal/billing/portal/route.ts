import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { appBaseUrl } from "@/lib/base-url";
import { getStripe } from "@/lib/billing";

// POST — → { url } Stripe's hosted billing portal, where the customer updates
// their card, downloads receipts or cancels. Subscription changes made there
// come back to us as webhooks, so the portal needs no special handling here.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const account = await db.account.findUnique({ where: { id: auth } });
  if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  if (!account.stripeCustomerId) {
    return NextResponse.json(
      { success: false, error: "No billing account yet — subscribe to a paid plan first." },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${appBaseUrl(new URL(req.url).origin)}/profile`,
    });
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
