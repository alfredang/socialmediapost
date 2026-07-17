import { getSessionAccount } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = (await getSessionAccount())!;
  const plan = getPlan(account.plan);
  return (
    <ProfileClient
      email={account.email}
      plan={{ id: plan.id, name: plan.name }}
      calendarWeekStart={account.calendarWeekStart}
      webhookUrl={account.webhookUrl ?? ""}
    />
  );
}
