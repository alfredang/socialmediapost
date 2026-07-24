import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { AnalyticsClient } from "./analytics-client";

export const metadata = { title: "User Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const account = await requireSessionAccount();
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

  // Post-level engagement — one row per published post, carrying its most
  // recent metric snapshot. This is where likes/comments/shares and per-post
  // views actually live (the daily AnalyticsSnapshot is audience-level). Rows
  // are sent raw with the publish date so the client can re-aggregate them for
  // whichever period the user selects, instead of a fixed 90-day sum.
  const targets = await db.postTarget.findMany({
    where: {
      status: "published",
      post: { profile: { accountId: account.id }, createdAt: { gte: from } },
    },
    select: {
      platform: true,
      publishedAt: true,
      post: { select: { profileId: true, createdAt: true } },
      metrics: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const postMetrics = targets.flatMap((t) => {
    const m = t.metrics[0];
    if (!m) return []; // no metric collected yet — don't fabricate a zero row
    const when = t.publishedAt ?? t.post.createdAt;
    return [{
      profileId: t.post.profileId,
      platform: t.platform,
      date: when.toISOString().slice(0, 10),
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
    }];
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
      postMetrics={postMetrics}
    />
  );
}
