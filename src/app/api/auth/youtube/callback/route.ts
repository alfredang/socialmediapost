import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import { exchangeCodeForToken, fetchChannel } from "@/lib/youtube";

// GET /api/auth/youtube/callback — completes the YouTube (Google) OAuth flow.
// Google access tokens last ~1h; the refresh token (from access_type=offline)
// keeps publishing alive via ensureFreshToken().
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "youtube");
  if (!cb.ok) return cb.res;

  try {
    const tokens = await exchangeCodeForToken(req.nextUrl.origin, cb.code);
    const channel = await fetchChannel(tokens.access_token);

    const data = {
      handle: channel.title,
      displayName: channel.title,
      externalUserId: channel.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      meta: null,
      status: "connected",
    };
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: cb.profile.id, platform: "youtube" } },
      update: data,
      create: { profileId: cb.profile.id, platform: "youtube", ...data },
    });
    return cb.redirect("connected");
  } catch (err) {
    console.error("[youtube] connect failed:", err);
    return cb.redirect("failed");
  }
}
