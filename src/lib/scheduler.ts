import { db } from "./db";
import { publishPost } from "./publish";
import { createPost } from "./publish";
import { computeSlots } from "./queue";

// One scheduler tick: publish due scheduled posts, run due pipeline slots,
// and grow analytics snapshots once per day.
export async function schedulerTick() {
  const now = new Date();

  // 1. Due scheduled posts
  const due = await db.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    select: { id: true },
  });
  for (const p of due) {
    await publishPost(p.id).catch((e) => console.error("[scheduler] publish failed", e));
  }

  // 2. Active pipelines — publish next pending item when a slot has passed since lastRun
  const pipelines = await db.pipeline.findMany({
    where: { status: "active" },
    include: { items: { where: { status: "pending" }, orderBy: { order: "asc" }, take: 1 } },
  });
  for (const pipe of pipelines) {
    if (pipe.items.length === 0) {
      if (pipe.loop) {
        await db.pipelineItem.updateMany({
          where: { pipelineId: pipe.id },
          data: { status: "pending", publishedAt: null },
        });
      }
      continue;
    }
    const config = {
      timezone: pipe.timezone,
      activeDays: JSON.parse(pipe.activeDays) as string[],
      slotTimes: JSON.parse(pipe.slotTimes) as string[],
      maxPerSlot: 1,
    };
    const since = pipe.lastRunAt ?? pipe.createdAt;
    const [nextSlot] = computeSlots(config, since, 1);
    if (!nextSlot || nextSlot > now) continue;

    const item = pipe.items[0];
    const { post } = await createPost({
      profileId: pipe.profileId,
      type: item.type as "video" | "photos" | "text",
      title: item.title,
      description: item.description,
      platforms: JSON.parse(pipe.platforms),
      media: JSON.parse(item.mediaFiles),
      source: "pipeline",
    });
    await publishPost(post.id).catch((e) => console.error("[scheduler] pipeline publish failed", e));
    await db.pipelineItem.update({
      where: { id: item.id },
      data: { status: "published", publishedAt: now },
    });
    await db.pipeline.update({ where: { id: pipe.id }, data: { lastRunAt: now } });
  }

  // 3. Daily analytics growth for connected accounts (simulated organic movement)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const anyToday = await db.analyticsSnapshot.findFirst({ where: { date: today } });
  if (!anyToday) {
    const accounts = await db.socialAccount.findMany({ where: { status: "connected" } });
    for (const acc of accounts) {
      const prev = await db.analyticsSnapshot.findFirst({
        where: { profileId: acc.profileId, platform: acc.platform },
        orderBy: { date: "desc" },
      });
      const grow = (base: number, pct: number) =>
        Math.max(0, Math.round(base * (1 + (Math.random() * 2 - 0.6) * pct)));
      await db.analyticsSnapshot.upsert({
        where: { profileId_platform_date: { profileId: acc.profileId, platform: acc.platform, date: today } },
        update: {},
        create: {
          profileId: acc.profileId,
          platform: acc.platform,
          date: today,
          followers: (prev?.followers ?? 1200) + Math.floor(Math.random() * 25),
          reach: grow(prev?.reach ?? 3500, 0.15),
          impressions: grow(prev?.impressions ?? 5200, 0.15),
          views: grow(prev?.views ?? 2600, 0.2),
          likes: grow(prev?.likes ?? 180, 0.25),
          comments: grow(prev?.comments ?? 24, 0.3),
          shares: grow(prev?.shares ?? 12, 0.3),
        },
      });
    }
  }
}

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;
  console.log("[scheduler] started (30s interval)");
  setInterval(() => {
    schedulerTick().catch((e) => console.error("[scheduler] tick error", e));
  }, 30000);
  schedulerTick().catch(() => {});
}
