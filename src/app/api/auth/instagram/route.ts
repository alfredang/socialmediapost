import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAccountId, signOAuthState } from "@/lib/session";
import { instagramConfigured, authorizeUrl, appBaseUrl } from "@/lib/instagram";

// GET /api/auth/instagram?profileId=... — starts the Instagram connect flow.
// With INSTAGRAM_CLIENT_ID/INSTAGRAM_CLIENT_SECRET set: real OAuth redirect.
// Without (local demo): connects a demo Instagram account immediately.
export async function GET(req: NextRequest) {
  // Browser-facing redirects must use the public base URL — behind a tunnel or
  // proxy, req.url resolves to the internal address (localhost:3000).
  const base = appBaseUrl(req.nextUrl.origin);

  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.redirect(new URL("/login", base));

  const profileId = req.nextUrl.searchParams.get("profileId") ?? "";
  const profile = await db.profile.findFirst({ where: { id: profileId, accountId } });
  if (!profile) {
    return NextResponse.redirect(new URL("/users?ig=profile-not-found", base));
  }

  if (instagramConfigured()) {
    const state = await signOAuthState(accountId, profile.id);
    return NextResponse.redirect(authorizeUrl(req.nextUrl.origin, state));
  }

  // Demo fallback — no Instagram credentials configured
  await db.socialAccount.upsert({
    where: { profileId_platform: { profileId: profile.id, platform: "instagram" } },
    update: { handle: "demo_instagram", status: "connected" },
    create: {
      profileId: profile.id,
      platform: "instagram",
      handle: "demo_instagram",
      displayName: "demo_instagram",
    },
  });
  return NextResponse.redirect(new URL("/users?ig=demo", base));
}
