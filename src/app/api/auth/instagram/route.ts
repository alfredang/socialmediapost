import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { instagramConfigured, authorizeUrl } from "@/lib/instagram";

// GET /api/auth/instagram?profileId=... — starts the Instagram connect flow.
// Requires INSTAGRAM_CLIENT_ID/INSTAGRAM_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, { platform: "instagram", configured: instagramConfigured, authorizeUrl });
}
