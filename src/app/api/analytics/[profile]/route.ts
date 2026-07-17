import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/analytics/{profile}?platform=&from=&to=
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profile: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { profile: profileName } = await params;
  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: auth.accountId, name: profileName } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const platform = sp.get("platform");
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from")
    ? new Date(sp.get("from")!)
    : new Date(to.getTime() - 30 * 86400000);

  const snaps = await db.analyticsSnapshot.findMany({
    where: {
      profileId: profile.id,
      ...(platform ? { platform } : {}),
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });

  const byPlatform: Record<string, { latest: (typeof snaps)[0] | null; series: object[] }> = {};
  for (const s of snaps) {
    byPlatform[s.platform] ??= { latest: null, series: [] };
    byPlatform[s.platform].latest = s;
    byPlatform[s.platform].series.push({
      date: s.date.toISOString().slice(0, 10),
      followers: s.followers,
      reach: s.reach,
      impressions: s.impressions,
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
    });
  }

  return NextResponse.json({
    success: true,
    profile: profile.name,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    platforms: Object.fromEntries(
      Object.entries(byPlatform).map(([k, v]) => [
        k,
        {
          followers: v.latest?.followers ?? 0,
          reach: v.latest?.reach ?? 0,
          impressions: v.latest?.impressions ?? 0,
          series: v.series,
        },
      ])
    ),
  });
}
