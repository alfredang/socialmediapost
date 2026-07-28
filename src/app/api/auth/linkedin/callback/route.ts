import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import { exchangeCodeForToken, fetchProfile } from "@/lib/linkedin";

// GET /api/auth/linkedin/callback — completes the LinkedIn OAuth flow and
// stores the ~60-day member token against the profile's SocialAccount.
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "linkedin");
  if (!cb.ok) return cb.res;

  try {
    const tokens = await exchangeCodeForToken(req.nextUrl.origin, cb.code);
    const info = await fetchProfile(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const data = {
      handle: info.name,
      displayName: info.name,
      externalUserId: info.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
      status: "connected",
    };
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: cb.profile.id, platform: "linkedin" } },
      update: data,
      create: { profileId: cb.profile.id, platform: "linkedin", ...data },
    });
    return cb.redirect("connected");
  } catch (err) {
    console.error("[linkedin] connect failed:", err);
    return cb.redirect("failed");
  }
}
