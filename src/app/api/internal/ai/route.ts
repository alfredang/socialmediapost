import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/internal-auth";
import { generateCopy } from "@/lib/ai";

// POST — AI copy assistant for the Upload page
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const copy = await generateCopy({
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    tone: body.tone,
  });
  return NextResponse.json({ success: true, ...copy });
}
