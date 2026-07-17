import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/uploadposts/media?user=&platform= — recently published media
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const targets = await db.postTarget.findMany({
    where: {
      status: "published",
      ...(sp.get("platform") ? { platform: sp.get("platform")! } : {}),
      post: {
        profile: {
          accountId: auth.accountId,
          ...(sp.get("user") ? { name: sp.get("user")! } : {}),
        },
      },
    },
    include: { post: { include: { profile: true } } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    success: true,
    media: targets.map((t) => ({
      platform: t.platform,
      user: t.post.profile.name,
      external_id: t.externalId,
      caption: t.adaptedTitle || t.adaptedBody,
      type: t.post.type,
      permalink: t.externalUrl,
      published_at: t.publishedAt?.toISOString(),
    })),
  });
}
