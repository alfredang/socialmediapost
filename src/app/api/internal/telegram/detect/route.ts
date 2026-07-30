import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/internal-auth";
import { detectChats } from "@/lib/telegram";

// POST /api/internal/telegram/detect — { botToken } → the channels/groups the bot
// can see, so the connect modal can offer them instead of a manual chat id.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const token = String(body.botToken ?? "").trim();
  if (!token) {
    return NextResponse.json({ success: false, error: "Enter the bot token first." }, { status: 400 });
  }

  try {
    const chats = await detectChats(token);
    return NextResponse.json({ success: true, chats });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Detection failed" },
      { status: 400 }
    );
  }
}
