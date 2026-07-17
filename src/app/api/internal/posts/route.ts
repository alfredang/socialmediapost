import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { saveUploadedFile, StoredFile } from "@/lib/upload";
import { createPost, publishPost, retryFailedTargets } from "@/lib/publish";
import { nextAvailableSlot } from "@/lib/queue";
import { PostType } from "@/lib/platforms";

// POST — create a post from the dashboard Upload page (multipart)
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const profileId = String(form.get("profileId") ?? "");
  const profile = await db.profile.findFirst({ where: { id: profileId, accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const type = String(form.get("type") ?? "text") as PostType;
  const platforms = JSON.parse(String(form.get("platforms") ?? "[]")) as string[];
  if (platforms.length === 0) {
    return NextResponse.json({ success: false, error: "Select at least one platform" }, { status: 400 });
  }
  const overrides = JSON.parse(String(form.get("overrides") ?? "{}"));
  const mode = String(form.get("mode") ?? "now"); // now|schedule|queue|draft

  const media: StoredFile[] = [];
  for (const item of form.getAll("media")) {
    if (item instanceof File && item.size > 0) media.push(await saveUploadedFile(item));
  }
  // Media URLs mode
  const mediaUrls = JSON.parse(String(form.get("mediaUrls") ?? "[]")) as string[];
  for (const url of mediaUrls) {
    media.push({ path: "", name: url, size: 0, mime: "url" });
  }

  let scheduledAt: Date | null = null;
  if (mode === "schedule") {
    scheduledAt = new Date(String(form.get("scheduledAt")));
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid schedule date" }, { status: 400 });
    }
  } else if (mode === "queue") {
    scheduledAt = await nextAvailableSlot(profile.id);
  }

  const { post } = await createPost({
    profileId: profile.id,
    type,
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    firstComment: String(form.get("firstComment") ?? ""),
    overrides,
    platforms,
    media,
    scheduledAt,
    source: "manual",
    draft: mode === "draft",
  });

  if (mode === "now") {
    const result = await publishPost(post.id);
    return NextResponse.json({ success: true, requestId: post.requestId, ...result });
  }
  return NextResponse.json({
    success: true,
    requestId: post.requestId,
    status: post.status,
    scheduledAt: scheduledAt?.toISOString() ?? null,
  });
}

// PATCH — { postId, action: "retry" | "publish-now" }
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const post = await db.post.findFirst({
    where: { id: body.postId ?? "", profile: { accountId: auth } },
  });
  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (body.action === "retry") {
    const result = await retryFailedTargets(post.id);
    return NextResponse.json({ success: true, ...result });
  }
  if (body.action === "publish-now") {
    const result = await publishPost(post.id);
    return NextResponse.json({ success: true, ...result });
  }
  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

// DELETE ?id= — delete a draft/scheduled post
export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const post = await db.post.findFirst({
    where: { id: id ?? "", profile: { accountId: auth } },
  });
  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.post.delete({ where: { id: post.id } });
  return NextResponse.json({ success: true });
}
