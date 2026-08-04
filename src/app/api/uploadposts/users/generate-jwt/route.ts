import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { signProfileJwt } from "@/lib/session";
import { appBaseUrl } from "@/lib/base-url";

// POST /api/uploadposts/users/generate-jwt — { username } → shareable connect-link token
//
// connect_url must carry the public domain: it is given to the API caller's own
// end users. req.nextUrl.origin resolves to the internal address behind a
// tunnel or reverse proxy, so PUBLIC_BASE_URL takes precedence when set.
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
  const origin = appBaseUrl(req.nextUrl.origin);
  return NextResponse.json({
    success: true,
    username,
    access_token: token,
    connect_url: `${origin}/connect?token=${token}`,
    expires_in: 86400,
  });
}
