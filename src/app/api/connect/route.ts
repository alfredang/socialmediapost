import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProfileJwt } from "@/lib/session";

// POST — whitelabel end-user connects a social account via JWT link
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const payload = await verifyProfileJwt(String(body.token ?? ""));
  if (!payload) return NextResponse.json({ success: false, error: "Invalid or expired link" }, { status: 401 });

  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: payload.accountId, name: payload.profile } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const handle = String(body.handle ?? "").trim().replace(/^@/, "");
  if (!handle) return NextResponse.json({ success: false, error: "Handle required" }, { status: 400 });

  await db.socialAccount.upsert({
    where: { profileId_platform: { profileId: profile.id, platform: String(body.platform) } },
    update: { handle, status: "connected" },
    create: { profileId: profile.id, platform: String(body.platform), handle, displayName: handle },
  });
  return NextResponse.json({ success: true });
}
