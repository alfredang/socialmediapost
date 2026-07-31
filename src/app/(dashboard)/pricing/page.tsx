import { requireSessionAccount } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { monthlyUsage } from "@/lib/usage";
import { isBillingConfigured } from "@/lib/billing";
import { PricingClient } from "./pricing-client";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const account = await requireSessionAccount();
  const usage = await monthlyUsage(account.id);
  const plan = getPlan(account.plan);
  const { checkout } = await searchParams;

  return (
    <PricingClient
      currentPlan={account.plan}
      currentInterval={account.planInterval}
      checkoutResult={checkout ?? null}
      billingConfigured={isBillingConfigured()}
      subscription={{
        status: account.subscriptionStatus,
        cancelAtPeriodEnd: account.cancelAtPeriodEnd,
        currentPeriodEnd: account.currentPeriodEnd?.toISOString() ?? null,
        hasCustomer: Boolean(account.stripeCustomerId),
      }}
      usage={{
        uploadsUsed: usage.uploadsUsed,
        uploadsQuota: plan.uploadsPerMonth,
        ffmpegUsed: usage.ffmpegUsed,
        ffmpegQuota: plan.ffmpegMinutes,
      }}
    />
  );
}
