import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOAuthState } from "@/lib/session";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchProfile,
  appBaseUrl,
} from "@/lib/instagram";

// GET /api/auth/instagram/callback — completes the real Instagram OAuth flow
// and stores the long-lived token against the profile's SocialAccount.
export async function GET(req: NextRequest) {
  // Browser-facing redirects must use the public base URL — behind a tunnel or
  // proxy, req.url resolves to the internal address (localhost:3000).
  const base = appBaseUrl(req.nextUrl.origin);

  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    return NextResponse.redirect(new URL("/users?ig=denied", base));
  }

  const code = params.get("code");
  const state = params.get("state") ?? "";
  const verified = await verifyOAuthState(state);
  if (!code || !verified) {
    return NextResponse.redirect(new URL("/users?ig=invalid-state", base));
  }

  // Ensure the profile still exists and belongs to the account from the state.
  const profile = await db.profile.findFirst({
    where: { id: verified.profileId, accountId: verified.accountId },
  });
  if (!profile) {
    return NextResponse.redirect(new URL("/users?ig=profile-not-found", base));
  }

  try {
    const short = await exchangeCodeForToken(req.nextUrl.origin, code);
    const long = await exchangeForLongLivedToken(short.access_token);
    const info = await fetchProfile(long.access_token);
    const expiresAt = new Date(Date.now() + long.expires_in * 1000);

    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: profile.id, platform: "instagram" } },
      update: {
        handle: info.username,
        displayName: info.username,
        externalUserId: info.user_id,
        accessToken: long.access_token,
        tokenExpiresAt: expiresAt,
        status: "connected",
      },
      create: {
        profileId: profile.id,
        platform: "instagram",
        handle: info.username,
        displayName: info.username,
        externalUserId: info.user_id,
        accessToken: long.access_token,
        tokenExpiresAt: expiresAt,
      },
    });
    return NextResponse.redirect(new URL("/users?ig=connected", base));
  } catch {
    return NextResponse.redirect(new URL("/users?ig=failed", base));
  }
}
