import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// POST /api/auth/verify-otp — { email, code } → sign in (creates the account on first login)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();

  const otp = await db.otpCode.findFirst({
    where: { email, code, usedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return NextResponse.json({ success: false, error: "Invalid or expired code" }, { status: 401 });
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

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
  return NextResponse.json({ success: true });
}
