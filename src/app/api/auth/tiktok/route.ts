import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { tiktokConfigured, authorizeRedirect } from "@/lib/tiktok";

// GET /api/auth/tiktok?profileId=... — starts the TikTok connect flow.
// Requires TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, {
    platform: "tiktok",
    configured: tiktokConfigured,
    authorizeUrl: authorizeRedirect,
  });
}
