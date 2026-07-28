import { NextResponse } from "next/server";

// Gone on purpose.
//
// This endpoint used to create a "connected" SocialAccount from a handle the
// visitor typed in. That account carried no OAuth token, so it looked connected
// throughout the UI while every publish attempt against it failed.
//
// Whitelabel users now go through the real provider OAuth instead:
//   GET /api/auth/<platform>?connect_token=<profile JWT>
// which is what the buttons on /connect link to.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Accounts can only be connected through platform OAuth. Open your connect link and use the Connect buttons.",
    },
    { status: 410 }
  );
}
