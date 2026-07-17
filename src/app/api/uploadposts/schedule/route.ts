import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

// GET /api/uploadposts/schedule — list scheduled posts
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const posts = await db.post.findMany({
    where: { profile: { accountId: auth.accountId }, status: "scheduled" },
    include: { targets: true, profile: true },
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json({
    success: true,
    scheduled: posts.map((p) => ({
      request_id: p.requestId,
      user: p.profile.name,
      title: p.title,
      type: p.type,
      scheduled_date: p.scheduledAt?.toISOString(),
      platforms: p.targets.map((t) => t.platform),
    })),
  });
}

// PATCH /api/uploadposts/schedule — { request_id, scheduled_date }
export async function PATCH(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { request_id, scheduled_date } = body;
  if (!request_id || !scheduled_date) {
    return NextResponse.json({ success: false, error: "Provide request_id and scheduled_date" }, { status: 400 });
  }
  const date = new Date(scheduled_date);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid scheduled_date" }, { status: 400 });
  }
  const post = await db.post.findFirst({
    where: { requestId: request_id, profile: { accountId: auth.accountId }, status: "scheduled" },
  });
  if (!post) return NextResponse.json({ success: false, error: "Scheduled post not found" }, { status: 404 });

  await db.post.update({ where: { id: post.id }, data: { scheduledAt: date } });
  return NextResponse.json({ success: true, request_id, scheduled_date: date.toISOString() });
}

// DELETE /api/uploadposts/schedule?request_id=...
export async function DELETE(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const requestId = req.nextUrl.searchParams.get("request_id");
  if (!requestId) return NextResponse.json({ success: false, error: "Missing request_id" }, { status: 400 });

  const post = await db.post.findFirst({
    where: { requestId, profile: { accountId: auth.accountId }, status: "scheduled" },
  });
  if (!post) return NextResponse.json({ success: false, error: "Scheduled post not found" }, { status: 404 });

  await db.post.delete({ where: { id: post.id } });
  return NextResponse.json({ success: true, message: "Scheduled post cancelled" });
}
