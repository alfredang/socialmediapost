import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomInt } from "crypto";
import { db } from "@/lib/db";

// POST /api/auth/request-otp — { email } → sends a 6-digit code + magic link.
// Without SMTP configured (dev), the code is returned in the response so the
// flow works out of the box.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
  }

  // Basic rate limit: max 5 codes per email per 15 min
  const recent = await db.otpCode.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 15 * 60000) } },
  });
  if (recent >= 5) {
    return NextResponse.json({ success: false, error: "Too many codes requested. Try again later." }, { status: 429 });
  }

  const code = String(randomInt(100000, 999999));
  const token = randomBytes(24).toString("hex");
  await db.otpCode.create({
    data: { email, code, token, expiresAt: new Date(Date.now() + 10 * 60000) },
  });

  const magicLink = `${req.nextUrl.origin}/api/auth/magic?token=${token}`;
  console.log(`[auth] OTP for ${email}: ${code} — magic link: ${magicLink}`);

  // TODO: send via SMTP/Resend when EMAIL_* env vars are configured.
  const devMode = !process.env.SMTP_HOST;
  return NextResponse.json({
    success: true,
    message: devMode
      ? "Email sending is not configured — use the code below (dev mode)."
      : "Check your inbox for the sign-in code and magic link.",
    ...(devMode ? { dev_code: code, dev_magic_link: magicLink } : {}),
  });
}
