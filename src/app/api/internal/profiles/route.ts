import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { getPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!/^[\w@-]{2,40}$/.test(name)) {
    return NextResponse.json(
      { success: false, error: "Allowed characters: letters, numbers, underscores, hyphens, and @" },
      { status: 400 }
    );
  }
  const account = await db.account.findUnique({
    where: { id: auth },
    include: { _count: { select: { profiles: true } } },
  });
  const plan = getPlan(account!.plan);
  if (account!._count.profiles >= plan.profiles) {
    return NextResponse.json(
      { success: false, error: `Profile limit reached (${plan.profiles} on the ${plan.name} plan). Upgrade to add more.` },
      { status: 429 }
    );
  }
  try {
    const profile = await db.profile.create({ data: { accountId: auth, name } });
    await db.queueSetting.create({ data: { profileId: profile.id } });
    return NextResponse.json({ success: true, profile: { id: profile.id, name: profile.name } });
  } catch {
    return NextResponse.json({ success: false, error: "Profile already exists" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const profile = await db.profile.findFirst({ where: { id: id ?? "", accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.profile.delete({ where: { id: profile.id } });
  return NextResponse.json({ success: true });
}
