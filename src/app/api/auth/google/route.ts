import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// GET /api/auth/google — starts Google OAuth.
// With GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET set: real OAuth redirect.
// Without (local demo): signs in immediately as a demo Google user.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId) {
    const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(url);
  }

  // Demo fallback — no Google credentials configured
  const email = "demo.google@example.com";
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
  return NextResponse.redirect(new URL("/users?google=demo", req.url));
}
