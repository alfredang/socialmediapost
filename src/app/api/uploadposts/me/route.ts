import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getPlan } from "@/lib/plans";

// GET /api/uploadposts/me — validate key, return account + plan info
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const account = await db.account.findUnique({
    where: { id: auth.accountId },
    include: { profiles: { select: { name: true } } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  const plan = getPlan(account.plan);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const uploadsThisMonth = await db.post.count({
    where: { profile: { accountId: account.id }, createdAt: { gte: monthStart }, status: { not: "draft" } },
  });

  return NextResponse.json({
    success: true,
    email: account.email,
    plan: plan.id,
    limits: {
      profiles: plan.profiles,
      uploads_per_month: plan.uploadsPerMonth,
      ffmpeg_minutes: plan.ffmpegMinutes,
    },
    usage: { uploads_this_month: uploadsThisMonth },
    profiles: account.profiles.map((p) => p.name),
  });
}
