import { NextResponse } from "next/server";
import { db } from "./db";
import { getSessionAccountId } from "./session";

export async function requireSession(): Promise<string | NextResponse> {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }
  return accountId;
}

// Instance administration (OAuth credentials, SMTP). Distinct from the
// per-account `TeamInvite.role`, which only scopes a team membership — this is
// Account.role, which governs the whole deployment.
//
// 404 rather than 403 for a signed-in non-admin: the settings area should not
// advertise its existence to ordinary users.
export async function requireAdmin(): Promise<string | NextResponse> {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }
  const account = await db.account.findUnique({ where: { id: accountId }, select: { role: true } });
  if (account?.role !== "admin") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return accountId;
}
