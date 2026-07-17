import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { destroySession } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | null> = {};
  if (typeof body.webhookUrl === "string") data.webhookUrl = body.webhookUrl || null;
  if (typeof body.calendarWeekStart === "string") data.calendarWeekStart = body.calendarWeekStart;
  if (typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    data.email = body.email.toLowerCase();
  }
  try {
    await db.account.update({ where: { id: auth }, data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Email already in use" }, { status: 409 });
  }
}

// DELETE — delete the whole account (danger zone)
export async function DELETE() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  await db.account.delete({ where: { id: auth } });
  await destroySession();
  return NextResponse.json({ success: true });
}
