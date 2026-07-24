import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { UsersClient } from "./users-client";

export const metadata = { title: "User Management" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const account = await requireSessionAccount();
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
        accounts: p.socialAccounts.map((a) => {
          // Facebook connections awaiting a Page pick expose the Page names
          // (never the tokens also stored in meta) so the client can render
          // the picker.
          let pageOptions: { id: string; name: string }[] | undefined;
          if (a.status === "pending_page" && a.meta) {
            try {
              const meta = JSON.parse(a.meta) as { pages?: { id: string; name: string }[] };
              pageOptions = meta.pages?.map((pg) => ({ id: pg.id, name: pg.name }));
            } catch {
              /* malformed meta — no picker */
            }
          }
          return {
            id: a.id,
            platform: a.platform,
            handle: a.handle,
            displayName: a.displayName ?? a.handle,
            status: a.status,
            pageOptions,
          };
        }),
      }))}
    />
  );
}
