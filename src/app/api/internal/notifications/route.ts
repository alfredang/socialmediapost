import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const notifications = await db.notification.findMany({
    where: { accountId: auth },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const unread = await db.notification.count({ where: { accountId: auth, read: false } });
  return NextResponse.json({ success: true, notifications, unread });
}

export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  await db.notification.updateMany({ where: { accountId: auth, read: false }, data: { read: true } });
  return NextResponse.json({ success: true });
}
