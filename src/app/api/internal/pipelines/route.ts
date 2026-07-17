import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { createPost, publishPost } from "@/lib/publish";
import { PostType } from "@/lib/platforms";

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
        create: (body.items ?? []).map((item: { title?: string; description?: string; type?: string }, i: number) => ({
          order: i,
          title: String(item.title ?? ""),
          description: String(item.description ?? ""),
          type: item.type ?? "text",
        })),
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
    const item = await db.pipelineItem.create({
      data: {
        pipelineId: pipeline.id,
        order: (max._max.order ?? -1) + 1,
        title: String(body.addItem.title ?? ""),
        description: String(body.addItem.description ?? ""),
        type: body.addItem.type ?? "text",
      },
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
