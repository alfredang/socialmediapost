import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { AnalyticsClient } from "./analytics-client";

export const metadata = { title: "User Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const account = (await getSessionAccount())!;
  const profiles = await db.profile.findMany({
    where: { accountId: account.id },
    include: { socialAccounts: true },
    orderBy: { createdAt: "asc" },
  });

  const from = new Date(Date.now() - 90 * 86400000);
  const snaps = await db.analyticsSnapshot.findMany({
    where: { profile: { accountId: account.id }, date: { gte: from } },
    orderBy: { date: "asc" },
  });

  return (
    <AnalyticsClient
      profiles={profiles.map((p) => ({
        id: p.id,
        name: p.name,
        accounts: p.socialAccounts.map((a) => ({
          platform: a.platform,
          handle: a.handle,
          status: a.status,
          id: a.id,
        })),
      }))}
      series={snaps.map((s) => ({
        profileId: s.profileId,
        platform: s.platform,
        date: s.date.toISOString().slice(0, 10),
        followers: s.followers,
        reach: s.reach,
        impressions: s.impressions,
        views: s.views,
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
      }))}
    />
  );
}
