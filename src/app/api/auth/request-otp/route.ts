import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomInt } from "crypto";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/base-url";
import { emailConfigured, sendOtpEmail } from "@/lib/mail";
import { applySettingsToEnv } from "@/lib/settings";

// POST /api/auth/request-otp — { email } → emails a 6-digit code + magic link.
// Mail delivery is mandatory: the code only ever leaves this server by email.
// Returning it in the response would let anyone sign in as any address.
export async function POST(req: NextRequest) {
  // SMTP may be configured in the admin settings page rather than the
  // environment; mail.ts reads process.env.
  await applySettingsToEnv();
  if (!emailConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Email delivery is not configured — set BREVO_API_KEY or SMTP_HOST before using email sign-in.",
      },
      { status: 503 }
    );
  }

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

  const magicLink = `${appBaseUrl(req.nextUrl.origin)}/api/auth/magic?token=${token}`;

  try {
    await sendOtpEmail(email, code, magicLink);
  } catch (err) {
    console.error("[auth] OTP send failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not send the email. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({
    success: true,
    message: "Check your inbox for the sign-in code and magic link.",
  });
}
