import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// POST /api/auth/login — { email, password } → session cookie.
// Accounts created via OTP/Google have a random hash, so password sign-in
// simply fails for them until they register a password.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
  }

  const account = await db.account.findUnique({ where: { email } });
  const ok = account && (await bcrypt.compare(password, account.passwordHash));
  if (!ok) {
    return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(account.id);
  return NextResponse.json({ success: true });
}
