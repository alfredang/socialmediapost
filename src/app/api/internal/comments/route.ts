import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/internal-auth";
import {
  normalizeCommentPlatform,
  resolveCommentTarget,
  readComments,
  replyToPlatformComment,
  graphErrorInfo,
  isCommentError,
} from "@/lib/comments";

// Dashboard-facing comments (session auth). Same shared logic as the public
// /api/uploadposts/comments route — this one is called by the Engagement page.
//
//   GET  /api/internal/comments?request_id=<id>&platform=facebook|instagram
//   POST /api/internal/comments   { request_id, comment_id, message, platform? }

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const platform = normalizeCommentPlatform(sp.get("platform"));
  if (typeof platform !== "string") {
    return NextResponse.json({ success: false, error: platform.error }, { status: platform.status });
  }

  const requestId = sp.get("request_id");
  if (!requestId) {
    return NextResponse.json({ success: false, error: "Provide request_id" }, { status: 400 });
  }

  const target = await resolveCommentTarget(auth, requestId, platform);
  if (isCommentError(target)) {
    return NextResponse.json({ success: false, error: target.error, reconnect: target.reconnect }, { status: target.status });
  }

  try {
    const { comments, count } = await readComments(platform, target.objectId, target.token);
    return NextResponse.json({ success: true, request_id: requestId, platform, comment_count: count, comments });
  } catch (err) {
    const info = graphErrorInfo(err);
    return NextResponse.json({ success: false, error: info.error, reconnect: info.reconnect }, { status: info.status });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const platform = normalizeCommentPlatform(body.platform ?? null);
  if (typeof platform !== "string") {
    return NextResponse.json({ success: false, error: platform.error }, { status: platform.status });
  }

  const requestId = String(body.request_id ?? "").trim();
  const commentId = String(body.comment_id ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!requestId || !commentId || !message) {
    return NextResponse.json(
      { success: false, error: "Provide request_id, comment_id and message" },
      { status: 400 }
    );
  }

  const target = await resolveCommentTarget(auth, requestId, platform);
  if (isCommentError(target)) {
    return NextResponse.json({ success: false, error: target.error, reconnect: target.reconnect }, { status: target.status });
  }

  try {
    const created = await replyToPlatformComment(platform, commentId, message, target.token);
    return NextResponse.json({ success: true, request_id: requestId, platform, comment_id: created.id });
  } catch (err) {
    const info = graphErrorInfo(err);
    return NextResponse.json({ success: false, error: info.error, reconnect: info.reconnect }, { status: info.status });
  }
}
