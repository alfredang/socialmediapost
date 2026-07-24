import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { facebookConfigured, authorizeUrl } from "@/lib/facebook";

// GET /api/auth/facebook?profileId=... — starts the Facebook connect flow.
// Requires FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, { platform: "facebook", configured: facebookConfigured, authorizeUrl });
}
