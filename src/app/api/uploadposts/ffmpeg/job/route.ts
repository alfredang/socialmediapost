import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getPlan } from "@/lib/plans";

// POST /api/uploadposts/ffmpeg/job — { command, estimated_minutes? } (simulated processing)
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (!body.command) {
    return NextResponse.json({ success: false, error: "Provide an FFmpeg command" }, { status: 400 });
  }

  const account = await db.account.findUnique({ where: { id: auth.accountId } });
  const plan = getPlan(account!.plan);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await db.ffmpegJob.aggregate({
    where: { accountId: auth.accountId, createdAt: { gte: monthStart } },
    _sum: { minutes: true },
  });
  const usedMinutes = used._sum.minutes ?? 0;
  const minutes = Math.max(0.1, Math.min(30, Number(body.estimated_minutes) || 1));
  if (usedMinutes + minutes > plan.ffmpegMinutes) {
    return NextResponse.json(
      { success: false, error: `FFmpeg quota exceeded (${plan.ffmpegMinutes} min/month on ${plan.name})` },
      { status: 429 }
    );
  }

  const job = await db.ffmpegJob.create({
    data: { accountId: auth.accountId, command: String(body.command), minutes },
  });
  return NextResponse.json({
    success: true,
    job_id: job.id,
    status: "completed",
    minutes_charged: minutes,
    output_url: `/api/media/processed-${job.id}.mp4`,
  });
}
