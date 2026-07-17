import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/uploadposts/status?request_id=...
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const requestId = req.nextUrl.searchParams.get("request_id");
  if (!requestId) {
    return NextResponse.json({ success: false, error: "Missing request_id" }, { status: 400 });
  }
  const post = await db.post.findFirst({
    where: { requestId, profile: { accountId: auth.accountId } },
    include: { targets: true, profile: true },
  });
  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({
    success: true,
    request_id: post.requestId,
    status: post.status,
    user: post.profile.name,
    type: post.type,
    scheduled_date: post.scheduledAt?.toISOString() ?? null,
    platforms: Object.fromEntries(
      post.targets.map((t) => [
        t.platform,
        { status: t.status, url: t.externalUrl, error: t.error, published_at: t.publishedAt?.toISOString() ?? null },
      ])
    ),
  });
}
