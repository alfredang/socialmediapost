import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { getPlan } from "@/lib/plans";

// GET /api/uploadposts/users — list profiles (whitelabel user management)
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const profiles = await db.profile.findMany({
    where: { accountId: auth.accountId },
    include: { socialAccounts: true },
  });
  return NextResponse.json({
    success: true,
    users: profiles.map((p) => ({
      username: p.name,
      created_at: p.createdAt.toISOString(),
      social_accounts: p.socialAccounts.map((a) => ({
        platform: a.platform,
        handle: a.handle,
        display_name: a.displayName,
        status: a.status,
      })),
    })),
  });
}

// POST /api/uploadposts/users — { username }
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  if (!/^[\w@-]{2,40}$/.test(username)) {
    return NextResponse.json(
      { success: false, error: "Invalid username. Allowed: letters, numbers, underscores, hyphens, and @" },
      { status: 400 }
    );
  }
  const account = await db.account.findUnique({
    where: { id: auth.accountId },
    include: { _count: { select: { profiles: true } } },
  });
  const plan = getPlan(account!.plan);
  if (account!._count.profiles >= plan.profiles) {
    return NextResponse.json(
      { success: false, error: `Profile limit reached (${plan.profiles} on the ${plan.name} plan)` },
      { status: 429 }
    );
  }
  try {
    const profile = await db.profile.create({ data: { accountId: auth.accountId, name: username } });
    return NextResponse.json({ success: true, username: profile.name }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Profile already exists" }, { status: 409 });
  }
}

// DELETE /api/uploadposts/users?username=...
export async function DELETE(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const username = req.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ success: false, error: "Missing username" }, { status: 400 });
  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: auth.accountId, name: username } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
  await db.profile.delete({ where: { id: profile.id } });
  return NextResponse.json({ success: true, message: `Profile "${username}" deleted` });
}
