import { NextRequest } from "next/server";
import { startConnect } from "@/lib/connect-flow";
import { threadsConfigured, authorizeUrl } from "@/lib/threads";

// GET /api/auth/threads?profileId=... — starts the Threads connect flow.
// Requires THREADS_CLIENT_ID/THREADS_CLIENT_SECRET; errors clearly if unset.
export async function GET(req: NextRequest) {
  return startConnect(req, {
    platform: "threads",
    configured: threadsConfigured,
    authorizeUrl,
  });
}
