import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// GET /api/auth/magic?token=... — magic-link sign in
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=missing-token", req.url));

  const otp = await db.otpCode.findUnique({ where: { token } });
  if (!otp || otp.usedAt || otp.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=expired-link", req.url));
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

  let account = await db.account.findUnique({ where: { email: otp.email } });
  if (!account) {
    account = await db.account.create({
      data: {
        email: otp.email,
        passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 10),
        plan: "free",
      },
    });
  }
  await createSession(account.id);
  return NextResponse.redirect(new URL("/users", req.url));
}
