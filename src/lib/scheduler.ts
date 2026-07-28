import { db } from "./db";
import { publishPost } from "./publish";
import { createPost, pipelineItemContent } from "./publish";
import { computeSlots } from "./queue";
import { syncAllAnalytics } from "./analytics-sync";

// One scheduler tick: publish due scheduled posts and run due pipeline slots.
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
      perPlatform: pipelineItemContent(item),
      source: "pipeline",
    });
    await publishPost(post.id).catch((e) => console.error("[scheduler] pipeline publish failed", e));
    await db.pipelineItem.update({
      where: { id: item.id },
      data: { status: "published", publishedAt: now },
    });
    await db.pipeline.update({ where: { id: pipe.id }, data: { lastRunAt: now } });
  }
}

// Analytics is polled on its own, much slower cadence — platform insight
// endpoints are heavily rate-limited and the numbers only move daily.
const ANALYTICS_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastAnalyticsRun = 0;

export async function analyticsTick(force = false) {
  if (!force && Date.now() - lastAnalyticsRun < ANALYTICS_INTERVAL_MS) return;
  lastAnalyticsRun = Date.now();
  const report = await syncAllAnalytics();
  if (report.accountsChecked > 0) {
    console.log(
      `[analytics] checked ${report.accountsChecked} account(s), ` +
        `${report.snapshotsWritten} snapshot(s), ${report.postMetricsWritten} post metric(s)`
    );
  }
}

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;
  console.log("[scheduler] started (30s publish interval, 6h analytics interval)");
  setInterval(() => {
    schedulerTick().catch((e) => console.error("[scheduler] tick error", e));
    analyticsTick().catch((e) => console.error("[analytics] tick error", e));
  }, 30000);
  schedulerTick().catch(() => {});
  analyticsTick().catch((e) => console.error("[analytics] initial sync error", e));
}
