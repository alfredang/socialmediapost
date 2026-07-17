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
    platforms: Object.fromEntries(
      post.targets.map((t) => {
        const m = t.metrics[0];
        return [
          t.platform,
          {
            status: t.status,
            url: t.externalUrl,
            views: m?.views ?? 0,
            likes: m?.likes ?? 0,
            comments: m?.comments ?? 0,
            shares: m?.shares ?? 0,
          },
        ];
      })
    ),
  });
}
