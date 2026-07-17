import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { TeamClient } from "./team-client";

export const metadata = { title: "Team Management" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const account = (await getSessionAccount())!;
  const plan = getPlan(account.plan);
  const invites = await db.teamInvite.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <TeamClient
      seats={plan.team}
      planName={plan.name}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
      }))}
    />
  );
}
