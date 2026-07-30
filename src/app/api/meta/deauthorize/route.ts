import { NextResponse } from "next/server";

// Meta "Uninstall / Deauthorize" callback (Threads, Facebook, Instagram). Meta
// POSTs a signed_request here when a user removes the app. We just acknowledge —
// the stored token becomes unusable and the account flips to needs_reauth on its
// next publish attempt, so there's nothing to clean up synchronously. Required
// by Meta for the app settings form to save.
export async function POST() {
  return NextResponse.json({ success: true });
}

// Meta sometimes probes with a GET when validating the URL.
export async function GET() {
  return NextResponse.json({ success: true });
}
