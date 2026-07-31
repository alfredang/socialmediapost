import { requireSessionAccount } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { monthlyUsage } from "@/lib/usage";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await requireSessionAccount();
  const plan = getPlan(account.plan);
  const usage = await monthlyUsage(account.id);
  return (
    <ProfileClient
      email={account.email}
      plan={{ id: plan.id, name: plan.name }}
      calendarWeekStart={account.calendarWeekStart}
      webhookUrl={account.webhookUrl ?? ""}
      hasBillingAccount={Boolean(account.stripeCustomerId)}
      subscriptionStatus={account.subscriptionStatus}
      usage={{
        uploadsUsed: usage.uploadsUsed,
        uploadsQuota: plan.uploadsPerMonth,
        ffmpegUsed: usage.ffmpegUsed,
        ffmpegQuota: plan.ffmpegMinutes,
      }}
    />
  );
}
