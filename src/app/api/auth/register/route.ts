import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// POST /api/auth/register — { email, password } → new account + session cookie.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await db.account.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "An account with this email already exists — sign in instead (use the email code if you never set a password)." },
      { status: 409 }
    );
  }

  const account = await db.account.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      plan: "free",
    },
  });
  await createSession(account.id);
  return NextResponse.json({ success: true });
}
