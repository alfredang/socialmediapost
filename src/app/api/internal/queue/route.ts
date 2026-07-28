import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getQueueConfig, computeQueuePreview } from "@/lib/queue";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const profileId = req.nextUrl.searchParams.get("profileId") ?? "";
  const profile = await db.profile.findFirst({ where: { id: profileId, accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const config = await getQueueConfig(profile.id);
  const slots = await computeQueuePreview(profile.id, config, 10);
  return NextResponse.json({ success: true, config, slots });
}

// POST — preview annotated slots for an UNSAVED config, so the UI can update
// live as the user toggles days / edits times without persisting each keystroke.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const profile = await db.profile.findFirst({ where: { id: body.profileId ?? "", accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const config = {
    timezone: typeof body.timezone === "string" ? body.timezone : "America/New_York",
    activeDays: Array.isArray(body.activeDays) ? body.activeDays.map(String) : [],
    slotTimes: Array.isArray(body.slotTimes) ? body.slotTimes.map(String) : [],
    maxPerSlot: Math.max(1, Number(body.maxPerSlot) || 1),
  };
  const slots = await computeQueuePreview(profile.id, config, 10);
  return NextResponse.json({ success: true, slots });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const profile = await db.profile.findFirst({ where: { id: body.profileId ?? "", accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  await db.queueSetting.upsert({
    where: { profileId: profile.id },
    update: {
      timezone: body.timezone,
      activeDays: JSON.stringify(body.activeDays ?? []),
      slotTimes: JSON.stringify(body.slotTimes ?? []),
      maxPerSlot: body.maxPerSlot ?? 1,
    },
    create: {
      profileId: profile.id,
      timezone: body.timezone,
      activeDays: JSON.stringify(body.activeDays ?? []),
      slotTimes: JSON.stringify(body.slotTimes ?? []),
      maxPerSlot: body.maxPerSlot ?? 1,
    },
  });
  const config = await getQueueConfig(profile.id);
  const slots = await computeQueuePreview(profile.id, config, 10);
  return NextResponse.json({ success: true, config, slots });
}
