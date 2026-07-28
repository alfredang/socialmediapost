import { requireSessionAccount } from "@/lib/session";
import { PricingClient } from "./pricing-client";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const account = await requireSessionAccount();
  return <PricingClient currentPlan={account.plan} currentInterval={account.planInterval} />;
}
