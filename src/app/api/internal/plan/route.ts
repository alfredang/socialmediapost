import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getPlan, PLAN_PRICING, PlanId } from "@/lib/plans";

// POST — { plan, interval } switch plan (simulated billing; generates an invoice)
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const plan = getPlan(String(body.plan ?? ""));
  const interval = body.interval === "yearly" ? "yearly" : "monthly";

  await db.account.update({
    where: { id: auth },
    data: { plan: plan.id, planInterval: interval },
  });

  if (plan.id !== "free") {
    const pricing = PLAN_PRICING[plan.id as PlanId];
    const total = interval === "yearly" ? pricing.annualTotal : pricing.monthly;
    const number = `FAC-${10000 + Math.floor(Math.random() * 90000)}`;
    await db.invoice.create({ data: { accountId: auth, number, total, status: "paid" } });
  }
  await db.notification.create({
    data: { accountId: auth, kind: "success", message: `Plan changed to ${plan.name} (${interval})` },
  });
  return NextResponse.json({ success: true, plan: plan.id, interval });
}
