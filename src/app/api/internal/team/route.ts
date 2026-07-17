import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const account = await db.account.findUnique({
    where: { id: auth },
    include: { _count: { select: { teamInvites: true } } },
  });
  const plan = getPlan(account!.plan);
  if (plan.team === 0) {
    return NextResponse.json(
      { success: false, error: "Team collaboration is available on Professional plans and above." },
      { status: 403 }
    );
  }
  if (account!._count.teamInvites >= plan.team) {
    return NextResponse.json({ success: false, error: `Team seat limit reached (${plan.team})` }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email" }, { status: 400 });
  }
  const invite = await db.teamInvite.create({
    data: { accountId: auth, email, role: body.role === "admin" ? "admin" : "member" },
  });
  return NextResponse.json({ success: true, invite });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const invite = await db.teamInvite.findFirst({ where: { id: id ?? "", accountId: auth } });
  if (!invite) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.teamInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ success: true });
}
