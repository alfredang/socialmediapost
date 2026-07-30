import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { appBaseUrl } from "@/lib/base-url";

// Meta "Data Deletion Request" callback (Threads, Facebook, Instagram). Meta
// POSTs a signed_request when a user asks to delete their data; the response MUST
// be JSON of the shape { url, confirmation_code } pointing at a status page.
// Required by Meta for the app settings form to save.
export async function POST(req: NextRequest) {
  const code = randomBytes(8).toString("hex");
  const base = appBaseUrl(req.nextUrl.origin);
  return NextResponse.json({
    url: `${base}/api/meta/data-deletion?code=${code}`,
    confirmation_code: code,
  });
}

// The status URL returned above resolves here (Meta requires it not to 404).
export async function GET() {
  return NextResponse.json({ success: true, status: "Data deletion request received." });
}
