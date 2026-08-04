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

// Revoking deletes the row outright rather than flagging it "revoked".
//
// A revoked key is dead weight: it can never authenticate again (authenticateApiKey
// requires status "active"), and the plaintext is unrecoverable — only a prefix and a
// SHA-256 hash were ever stored. Keeping the row just accumulates clutter in the UI.
// Request history is unaffected: ApiRequestLog is keyed on accountId, not on the key.
export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const key = await db.apiKey.findFirst({ where: { id: id ?? "", accountId: auth } });
  if (!key) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.apiKey.delete({ where: { id: key.id } });
  return NextResponse.json({ success: true });
}
