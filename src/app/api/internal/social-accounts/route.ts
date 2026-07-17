import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { PLATFORM_MAP } from "@/lib/platforms";

// POST — simulate the OAuth connect flow for a platform
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { profileId, platform, handle } = body;
  if (!PLATFORM_MAP[platform]) {
    return NextResponse.json({ success: false, error: "Unknown platform" }, { status: 400 });
  }
  const profile = await db.profile.findFirst({ where: { id: profileId, accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const cleanHandle = String(handle ?? profile.name).trim().replace(/^@/, "") || profile.name;
  const account = await db.socialAccount.upsert({
    where: { profileId_platform: { profileId, platform } },
    update: { handle: cleanHandle, status: "connected" },
    create: { profileId, platform, handle: cleanHandle, displayName: cleanHandle },
  });
  return NextResponse.json({ success: true, account });
}

// PATCH — fix a needs_reauth account
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const account = await db.socialAccount.findFirst({
    where: { id: body.id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.socialAccount.update({ where: { id: account.id }, data: { status: "connected" } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const account = await db.socialAccount.findFirst({
    where: { id: id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.socialAccount.delete({ where: { id: account.id } });
  return NextResponse.json({ success: true });
}
