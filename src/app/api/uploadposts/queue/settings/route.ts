import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getQueueConfig, computeSlots } from "@/lib/queue";

async function resolveProfile(accountId: string, userName: string | null) {
  if (!userName) return null;
  return db.profile.findUnique({ where: { accountId_name: { accountId, name: userName } } });
}

// GET /api/uploadposts/queue/settings?user=...
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const profile = await resolveProfile(auth.accountId, req.nextUrl.searchParams.get("user"));
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found (pass ?user=)" }, { status: 404 });

  const config = await getQueueConfig(profile.id);
  const preview = computeSlots(config, new Date(), 10);
  return NextResponse.json({
    success: true,
    user: profile.name,
    settings: config,
    next_slots: preview.map((d) => d.toISOString()),
  });
}

// PUT /api/uploadposts/queue/settings — { user, timezone?, active_days?, slot_times?, max_per_slot? }
export async function PUT(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const profile = await resolveProfile(auth.accountId, body.user ?? null);
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found (pass user)" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.timezone) data.timezone = body.timezone;
  if (Array.isArray(body.active_days)) data.activeDays = JSON.stringify(body.active_days);
  if (Array.isArray(body.slot_times)) data.slotTimes = JSON.stringify(body.slot_times);
  if (typeof body.max_per_slot === "number") data.maxPerSlot = body.max_per_slot;

  await db.queueSetting.upsert({
    where: { profileId: profile.id },
    update: data,
    create: { profileId: profile.id, ...data },
  });
  const config = await getQueueConfig(profile.id);
  return NextResponse.json({ success: true, user: profile.name, settings: config });
}
