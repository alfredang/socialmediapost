import { db } from "./db";

// One definition of "what counts against your plan this cycle", used by the
// quota check that enforces it and by every screen that displays it. When these
// drifted apart the dashboard showed 0 while uploads were being counted and
// blocked, so anything reporting usage must come through here.

export function billingCycleStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Drafts are excluded because they were never published anywhere. Failed posts
// are NOT excluded — the platform call was still made on the account's behalf.
export async function uploadsUsedThisCycle(accountId: string): Promise<number> {
  return db.post.count({
    where: {
      profile: { accountId },
      createdAt: { gte: billingCycleStart() },
      status: { not: "draft" },
    },
  });
}

export type MonthlyUsage = {
  uploadsUsed: number;
  apiCalls: number;
  ffmpegUsed: number;
  ffmpegRequests: number;
};

export async function monthlyUsage(accountId: string): Promise<MonthlyUsage> {
  const monthStart = billingCycleStart();
  const [uploadsUsed, apiCalls, ffmpegAgg, ffmpegRequests] = await Promise.all([
    uploadsUsedThisCycle(accountId),
    db.apiRequestLog.count({ where: { accountId, createdAt: { gte: monthStart } } }),
    db.ffmpegJob.aggregate({ where: { accountId, createdAt: { gte: monthStart } }, _sum: { minutes: true } }),
    db.ffmpegJob.count({ where: { accountId, createdAt: { gte: monthStart } } }),
  ]);
  return { uploadsUsed, apiCalls, ffmpegUsed: ffmpegAgg._sum.minutes ?? 0, ffmpegRequests };
}
