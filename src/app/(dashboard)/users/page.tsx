import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { UsersClient } from "./users-client";

export const metadata = { title: "User Management" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const account = (await getSessionAccount())!;
  const profiles = await db.profile.findMany({
    where: { accountId: account.id },
    include: { socialAccounts: true },
    orderBy: { createdAt: "asc" },
  });
  const plan = getPlan(account.plan);

  return (
    <UsersClient
      plan={{ id: plan.id, name: plan.name, profiles: plan.profiles }}
      profiles={profiles.map((p) => ({
        id: p.id,
        name: p.name,
        accounts: p.socialAccounts.map((a) => ({
          id: a.id,
          platform: a.platform,
          handle: a.handle,
          displayName: a.displayName ?? a.handle,
          status: a.status,
        })),
      }))}
    />
  );
}
