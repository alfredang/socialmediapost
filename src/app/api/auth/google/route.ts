import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/base-url";
import { applySettingsToEnv } from "@/lib/settings";

// GET /api/auth/google — starts Google OAuth.
// Requires GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, from the environment or the
// admin settings page. Without them the button errors back to /login rather
// than signing anyone in.
export async function GET(req: NextRequest) {
  await applySettingsToEnv();
  const base = appBaseUrl(req.nextUrl.origin);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", base));
  }

  const redirectUri = `${base}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(url);
}
