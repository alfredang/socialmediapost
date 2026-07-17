import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { nextAvailableSlot } from "@/lib/queue";

// POST /api/uploadposts/add_to_queue — { request_id } (a draft/scheduled post) → auto-schedule to next slot
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (!body.request_id) {
    return NextResponse.json({ success: false, error: "Provide request_id" }, { status: 400 });
  }
  const post = await db.post.findFirst({
    where: { requestId: body.request_id, profile: { accountId: auth.accountId } },
  });
  if (!post) return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
  if (!["draft", "scheduled", "queued"].includes(post.status)) {
    return NextResponse.json({ success: false, error: `Post is already ${post.status}` }, { status: 409 });
  }

  const slot = await nextAvailableSlot(post.profileId);
  await db.post.update({ where: { id: post.id }, data: { status: "scheduled", scheduledAt: slot } });
  return NextResponse.json({ success: true, request_id: post.requestId, scheduled_date: slot.toISOString() });
}
