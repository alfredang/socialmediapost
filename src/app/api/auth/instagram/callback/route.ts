import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchProfile,
} from "@/lib/instagram";

// GET /api/auth/instagram/callback — completes the real Instagram OAuth flow
// and stores the long-lived token against the profile's SocialAccount.
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "instagram");
  if (!cb.ok) return cb.res;

  try {
    const short = await exchangeCodeForToken(req.nextUrl.origin, cb.code);
    const long = await exchangeForLongLivedToken(short.access_token);
    const info = await fetchProfile(long.access_token);
    const expiresAt = new Date(Date.now() + long.expires_in * 1000);

    const data = {
      handle: info.username,
      displayName: info.username,
      externalUserId: info.user_id,
      accessToken: long.access_token,
      tokenExpiresAt: expiresAt,
      status: "connected",
    };
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: cb.profile.id, platform: "instagram" } },
      update: data,
      create: { profileId: cb.profile.id, platform: "instagram", ...data },
    });
    return cb.redirect("connected");
  } catch (err) {
    console.error("[instagram] connect failed:", err);
    return cb.redirect("failed");
  }
}
