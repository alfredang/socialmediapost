import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getPlan } from "@/lib/plans";

// GET /api/uploadposts/ffmpeg/usage
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const account = await db.account.findUnique({ where: { id: auth.accountId } });
  const plan = getPlan(account!.plan);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [agg, count] = await Promise.all([
    db.ffmpegJob.aggregate({
      where: { accountId: auth.accountId, createdAt: { gte: monthStart } },
      _sum: { minutes: true },
    }),
    db.ffmpegJob.count({ where: { accountId: auth.accountId, createdAt: { gte: monthStart } } }),
  ]);
  const used = agg._sum.minutes ?? 0;
  return NextResponse.json({
    success: true,
    plan: plan.id,
    monthly_quota_minutes: plan.ffmpegMinutes,
    used_minutes: used,
    remaining_minutes: Math.max(0, plan.ffmpegMinutes - used),
    total_requests: count,
  });
}
