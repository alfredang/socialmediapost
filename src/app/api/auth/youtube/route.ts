import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { youtubeConfigured, authorizeUrl } from "@/lib/youtube";

// GET /api/auth/youtube?profileId=... — starts the YouTube (Google OAuth) connect
// flow. Reuses GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, {
    platform: "youtube",
    configured: youtubeConfigured,
    authorizeUrl,
  });
}
