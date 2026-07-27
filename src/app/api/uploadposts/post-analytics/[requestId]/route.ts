import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/uploadposts/post-analytics/{request_id}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { requestId } = await params;
  const post = await db.post.findFirst({
    where: { requestId, profile: { accountId: auth.accountId } },
    include: { targets: { include: { metrics: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({
    success: true,
    request_id: post.requestId,
    title: post.title,
    // null means the metric has not been collected yet — it is not a measured
    // zero. collected_at lets callers tell "no data yet" from a genuine zero.
    platforms: Object.fromEntries(
      post.targets.map((t) => {
        const m = t.metrics[0];
        return [
          t.platform,
          {
            status: t.status,
            url: t.externalUrl,
            views: m?.views ?? null,
            likes: m?.likes ?? null,
            comments: m?.comments ?? null,
            shares: m?.shares ?? null,
            collected_at: m?.createdAt.toISOString() ?? null,
          },
        ];
      })
    ),
  });
}
