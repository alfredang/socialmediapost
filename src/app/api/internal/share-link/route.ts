import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { signProfileJwt } from "@/lib/session";
import { appBaseUrl } from "@/lib/base-url";

// POST — whitelabel connect-link for a profile (dashboard version of generate-jwt)
//
// The link is handed to someone else's customers, so it must carry the public
// domain. req.nextUrl.origin is the INTERNAL address behind a tunnel or reverse
// proxy (and its scheme follows X-Forwarded-Proto), so PUBLIC_BASE_URL wins.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "");
  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: auth, name: username } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const token = await signProfileJwt(auth, username);
  return NextResponse.json({
    success: true,
    connect_url: `${appBaseUrl(req.nextUrl.origin)}/connect?token=${token}`,
  });
}
