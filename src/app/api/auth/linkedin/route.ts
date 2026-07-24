import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { linkedinConfigured, authorizeUrl } from "@/lib/linkedin";

// GET /api/auth/linkedin?profileId=... — starts the LinkedIn connect flow.
// Requires LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, { platform: "linkedin", configured: linkedinConfigured, authorizeUrl });
}
