import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { signProfileJwt } from "@/lib/session";

// POST /api/uploadposts/users/generate-jwt — { username } → shareable connect-link token
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: auth.accountId, name: username } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const token = await signProfileJwt(auth.accountId, username);
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    success: true,
    username,
    access_token: token,
    connect_url: `${origin}/connect?token=${token}`,
    expires_in: 86400,
  });
}
