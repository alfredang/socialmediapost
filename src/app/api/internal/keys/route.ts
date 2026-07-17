import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { generateApiKey } from "@/lib/apikey";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "API Key").slice(0, 60);
  const { key, hashed, prefix } = generateApiKey();
  await db.apiKey.create({ data: { accountId: auth, label, hashedKey: hashed, prefix } });
  // The plaintext key is returned exactly once.
  return NextResponse.json({ success: true, key, prefix, label });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const key = await db.apiKey.findFirst({ where: { id: id ?? "", accountId: auth } });
  if (!key) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.apiKey.update({ where: { id: key.id }, data: { status: "revoked" } });
  return NextResponse.json({ success: true });
}
