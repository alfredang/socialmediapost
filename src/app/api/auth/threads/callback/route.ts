import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import { exchangeCodeForToken, exchangeForLongLivedToken, fetchProfile } from "@/lib/threads";

// GET /api/auth/threads/callback — completes the Threads OAuth flow. Exchanges
// the code for a short-lived token, upgrades it to a ~60-day long-lived token,
// and stores the connection. ensureFreshToken() refreshes it before expiry.
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "threads");
  if (!cb.ok) return cb.res;

  try {
    const short = await exchangeCodeForToken(req.nextUrl.origin, cb.code);
    const long = await exchangeForLongLivedToken(short.access_token);
    const profile = await fetchProfile(long.access_token, short.user_id);

    const data = {
      handle: profile.username,
      displayName: profile.username,
      externalUserId: profile.id,
      accessToken: long.access_token,
      refreshToken: null,
      tokenExpiresAt: new Date(Date.now() + long.expires_in * 1000),
      meta: null,
      status: "connected",
    };
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: cb.profile.id, platform: "threads" } },
      update: data,
      create: { profileId: cb.profile.id, platform: "threads", ...data },
    });
    return cb.redirect("connected");
  } catch (err) {
    console.error("[threads] connect failed:", err);
    return cb.redirect("failed");
  }
}
