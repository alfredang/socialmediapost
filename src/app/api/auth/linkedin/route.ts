import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { linkedinConfigured, authorizeUrl } from "@/lib/linkedin";
import { applySettingsToEnv } from "@/lib/settings";

// GET /api/auth/linkedin?profileId=... — starts the LinkedIn connect flow.
// Credentials come from LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET, set either in
// the environment or on the admin settings page; errors clearly if unset.
export async function GET(req: NextRequest) {
  await applySettingsToEnv();
  return startConnect(req, { platform: "linkedin", configured: linkedinConfigured, authorizeUrl });
}
