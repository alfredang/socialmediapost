import { NextRequest, NextResponse } from "next/server";
import { verifyProfileJwt } from "@/lib/session";

// GET /api/uploadposts/users/validate-jwt?token=...
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
  const payload = await verifyProfileJwt(token);
  if (!payload) return NextResponse.json({ success: false, valid: false }, { status: 401 });
  return NextResponse.json({ success: true, valid: true, username: payload.profile });
}
