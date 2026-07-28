import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import { exchangeCodeForToken, fetchProfile, PKCE_COOKIE } from "@/lib/tiktok";

// GET /api/auth/tiktok/callback — completes the TikTok OAuth flow. TikTok
// access tokens last ~24h; the 365-day refresh token keeps publishing alive
// via ensureFreshToken().
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "tiktok");
  if (!cb.ok) return cb.res;

  const verifier = req.cookies.get(PKCE_COOKIE)?.value;
  if (!verifier) return cb.redirect("invalid-state");

  try {
    const tokens = await exchangeCodeForToken(req.nextUrl.origin, cb.code, verifier);
    const info = await fetchProfile(tokens.access_token);
    const handle = info.display_name;

    const data = {
      handle,
      displayName: info.display_name,
      externalUserId: tokens.open_id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      meta: JSON.stringify({
        refreshExpiresAt: new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString(),
      }),
      status: "connected",
    };
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: cb.profile.id, platform: "tiktok" } },
      update: data,
      create: { profileId: cb.profile.id, platform: "tiktok", ...data },
    });
    return cb.redirect("connected");
  } catch (err) {
    console.error("[tiktok] connect failed:", err);
    return cb.redirect("failed");
  }
}
