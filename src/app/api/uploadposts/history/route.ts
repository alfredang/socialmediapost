import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/uploadposts/history?page=1&limit=20&platform=&user=
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20")));
  const platform = sp.get("platform");
  const user = sp.get("user");

  const where = {
    profile: { accountId: auth.accountId, ...(user ? { name: user } : {}) },
    status: { notIn: ["draft"] },
    ...(platform ? { targets: { some: { platform } } } : {}),
  };
  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: { targets: true, profile: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    success: true,
    page,
    limit,
    total,
    history: posts.map((p) => ({
      request_id: p.requestId,
      user: p.profile.name,
      type: p.type,
      title: p.title,
      status: p.status,
      created_at: p.createdAt.toISOString(),
      scheduled_date: p.scheduledAt?.toISOString() ?? null,
      platforms: p.targets.map((t) => ({
        platform: t.platform,
        status: t.status,
        url: t.externalUrl,
        error: t.error,
      })),
    })),
  });
}
