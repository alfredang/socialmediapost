import { NextResponse } from "next/server";
import { getSessionAccountId } from "./session";

export async function requireSession(): Promise<string | NextResponse> {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }
  return accountId;
}
