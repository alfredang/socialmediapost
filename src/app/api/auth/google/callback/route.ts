import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// GET /api/auth/google/callback — completes the real Google OAuth flow
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=google-denied", req.url));

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${req.nextUrl.origin}/api/auth/google/callback`,
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
    return NextResponse.redirect(new URL("/users", req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google-failed", req.url));
  }
}
