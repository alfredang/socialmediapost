import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { saveUploadedFile, sanitizeStoredMedia, StoredFile } from "@/lib/upload";
import { createPost, publishPost, retryFailedTargets, PlatformContent } from "@/lib/publish";
import { nextAvailableSlot } from "@/lib/queue";
import { PostType, PLATFORM_MAP } from "@/lib/platforms";

const POST_TYPES = new Set(["text", "photos", "video"]);

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
  // Per-platform content overrides: { platform: { type, media: StoredFile[] } }.
  // Media here is already-staged StoredFile refs (via /api/internal/media) or URL
  // stubs — sanitized the same way as the base media.
  const perPlatform: Record<string, PlatformContent> = {};
  let rawPerPlatform: Record<string, { type?: string; media?: unknown }> = {};
  try {
    rawPerPlatform = JSON.parse(String(form.get("perPlatform") ?? "{}"));
  } catch {
    return NextResponse.json({ success: false, error: "Invalid perPlatform payload" }, { status: 400 });
  }
  for (const [platform, pc] of Object.entries(rawPerPlatform)) {
    if (!platforms.includes(platform)) continue;
    const t = (POST_TYPES.has(String(pc.type)) ? String(pc.type) : type) as PostType;
    const m = sanitizeStoredMedia(pc.media);
    const def = PLATFORM_MAP[platform];
    if (!def?.supports.includes(t)) {
      return NextResponse.json(
        { success: false, error: `${def?.name ?? platform} can't publish ${t} posts` },
        { status: 400 }
      );
    }
    if (t !== "text" && m.length === 0) {
      return NextResponse.json(
        { success: false, error: `${def.name} is a ${t} post but has no media` },
        { status: 400 }
      );
    }
    perPlatform[platform] = { type: t, media: m };
  }

  // Validate base content for any platform WITHOUT an override.
  for (const platform of platforms) {
    if (perPlatform[platform]) continue;
    const def = PLATFORM_MAP[platform];
    if (def && !def.supports.includes(type)) {
      return NextResponse.json(
        { success: false, error: `${def.name} can't publish ${type} posts — give it its own content` },
        { status: 400 }
      );
    }
    if (type !== "text" && media.length === 0) {
      return NextResponse.json(
        { success: false, error: `A ${type} post needs at least one media file` },
        { status: 400 }
      );
    }
  }

  let scheduledAt: Date | null = null;
  if (mode === "schedule") {
    scheduledAt = new Date(String(form.get("scheduledAt")));
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid schedule date" }, { status: 400 });
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: "Scheduled time must be in the future" },
        { status: 400 }
      );
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
    perPlatform,
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
