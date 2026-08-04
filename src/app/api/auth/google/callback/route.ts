import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { appBaseUrl } from "@/lib/base-url";
import { applySettingsToEnv } from "@/lib/settings";

// GET /api/auth/google/callback — completes the real Google OAuth flow
export async function GET(req: NextRequest) {
  // Credentials may come from the admin settings page rather than the
  // environment; the token exchange below reads them off process.env.
  await applySettingsToEnv();
  const base = appBaseUrl(req.nextUrl.origin);

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=google-denied", base));

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await userRes.json();
    const email = String(info.email ?? "").toLowerCase();
    if (!email) throw new Error("No email from Google");

    let account = await db.account.findUnique({ where: { email } });
    if (!account) {
      account = await db.account.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 10),
          plan: "free",
        },
      });
    }
    await createSession(account.id);
    return NextResponse.redirect(new URL("/users", base));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google-failed", base));
  }
}
