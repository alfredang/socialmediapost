import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { createPost, publishPost, pipelineItemContent } from "@/lib/publish";
import { PostType, PLATFORM_MAP } from "@/lib/platforms";
import { sanitizeStoredMedia } from "@/lib/upload";

const ITEM_TYPES = new Set(["text", "photos", "video"]);

interface RawPlatformContent {
  type?: string;
  media?: unknown;
}
interface RawItem {
  title?: string;
  description?: string;
  type?: string;
  media?: unknown;
  perPlatform?: Record<string, RawPlatformContent>;
}

interface ItemData {
  order: number;
  title: string;
  description: string;
  type: string;
  mediaFiles: string;
  perPlatform: string;
}

// Validates one platform's effective content (its override, or the base).
function checkPlatformContent(
  platform: string,
  type: string,
  media: { length: number },
  order: number
): string | null {
  const def = PLATFORM_MAP[platform];
  if (!def?.supports.includes(type as PostType)) {
    return `Content item #${order + 1}: ${def?.name ?? platform} can't publish ${type} posts.`;
  }
  if (type !== "text" && media.length === 0) {
    return `Content item #${order + 1}: ${def.name} is a ${type} post but has no media attached.`;
  }
  return null;
}

// Normalizes one wizard item into DB fields, or returns an error string. Each
// platform uses its per-platform override when present, else the base type/media
// — so a single item can send video to TikTok and photos to Instagram.
function buildItem(item: RawItem, order: number, platforms: string[]): { data: ItemData } | { error: string } {
  const baseType = ITEM_TYPES.has(String(item.type)) ? String(item.type) : "text";
  const baseMedia = sanitizeStoredMedia(item.media);

  const perPlatform: Record<string, { type: string; media: ReturnType<typeof sanitizeStoredMedia> }> = {};
  for (const [platform, pc] of Object.entries(item.perPlatform ?? {})) {
    if (!platforms.includes(platform)) continue; // ignore stray platforms
    const t = ITEM_TYPES.has(String(pc.type)) ? String(pc.type) : baseType;
    perPlatform[platform] = { type: t, media: sanitizeStoredMedia(pc.media) };
  }

  // Validate every platform against the content it will actually publish.
  for (const platform of platforms) {
    const eff = perPlatform[platform] ?? { type: baseType, media: baseMedia };
    const err = checkPlatformContent(platform, eff.type, eff.media, order);
    if (err) return { error: err };
  }

  return {
    data: {
      order,
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      type: baseType,
      mediaFiles: JSON.stringify(baseMedia),
      perPlatform: JSON.stringify(perPlatform),
    },
  };
}

// POST — create a pipeline with content items
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const profile = await db.profile.findFirst({ where: { id: body.profileId ?? "", accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
  if (!body.name || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    return NextResponse.json({ success: false, error: "Provide a name and at least one platform" }, { status: 400 });
  }

  const platforms = body.platforms.map(String);
  const rawItems: RawItem[] = Array.isArray(body.items) ? body.items : [];
  const built = rawItems.map((item, i) => buildItem(item, i, platforms));
  const bad = built.find((b) => "error" in b);
  if (bad && "error" in bad) {
    return NextResponse.json({ success: false, error: bad.error }, { status: 400 });
  }

  const pipeline = await db.pipeline.create({
    data: {
      profileId: profile.id,
      name: String(body.name).slice(0, 80),
      platforms: JSON.stringify(body.platforms),
      timezone: body.timezone ?? "America/New_York",
      activeDays: JSON.stringify(body.activeDays ?? ["mon", "wed", "fri"]),
      slotTimes: JSON.stringify(body.slotTimes ?? ["10:00"]),
      loop: Boolean(body.loop),
      items: {
        create: built.map((b) => (b as { data: ItemData }).data),
      },
    },
    include: { items: true },
  });
  return NextResponse.json({ success: true, pipeline });
}

// PATCH — { id, action: pause|resume|run-now } or { id, addItem: {...} }
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const pipeline = await db.pipeline.findFirst({
    where: { id: body.id ?? "", profile: { accountId: auth } },
    include: { items: { where: { status: "pending" }, orderBy: { order: "asc" }, take: 1 } },
  });
  if (!pipeline) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (body.action === "pause" || body.action === "resume") {
    await db.pipeline.update({
      where: { id: pipeline.id },
      data: { status: body.action === "pause" ? "paused" : "active" },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "run-now") {
    const item = pipeline.items[0];
    if (!item) return NextResponse.json({ success: false, error: "No pending items in this pipeline" }, { status: 409 });
    const { post } = await createPost({
      profileId: pipeline.profileId,
      type: item.type as PostType,
      title: item.title,
      description: item.description,
      platforms: JSON.parse(pipeline.platforms),
      media: JSON.parse(item.mediaFiles),
      perPlatform: pipelineItemContent(item),
      source: "pipeline",
    });
    const result = await publishPost(post.id);
    await db.pipelineItem.update({
      where: { id: item.id },
      data: { status: "published", publishedAt: new Date() },
    });
    await db.pipeline.update({ where: { id: pipeline.id }, data: { lastRunAt: new Date() } });
    return NextResponse.json({ success: true, ...result });
  }

  if (body.addItem) {
    const max = await db.pipelineItem.aggregate({
      where: { pipelineId: pipeline.id },
      _max: { order: true },
    });
    const built = buildItem(
      body.addItem as RawItem,
      (max._max.order ?? -1) + 1,
      JSON.parse(pipeline.platforms) as string[]
    );
    if ("error" in built) {
      return NextResponse.json({ success: false, error: built.error }, { status: 400 });
    }
    const item = await db.pipelineItem.create({
      data: { pipelineId: pipeline.id, ...built.data },
    });
    return NextResponse.json({ success: true, item });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

// DELETE ?id= (pipeline) or ?itemId=
export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  if (sp.get("itemId")) {
    const item = await db.pipelineItem.findFirst({
      where: { id: sp.get("itemId")!, pipeline: { profile: { accountId: auth } } },
    });
    if (!item) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    await db.pipelineItem.delete({ where: { id: item.id } });
    return NextResponse.json({ success: true });
  }
  const pipeline = await db.pipeline.findFirst({
    where: { id: sp.get("id") ?? "", profile: { accountId: auth } },
  });
  if (!pipeline) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.pipeline.delete({ where: { id: pipeline.id } });
  return NextResponse.json({ success: true });
}
