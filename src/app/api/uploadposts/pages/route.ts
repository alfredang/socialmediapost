import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import type { FacebookMeta } from "@/lib/facebook";

// GET /api/uploadposts/pages?user=<profile>&platform=facebook
//
// Lists the Facebook Pages the connected account can publish to, and which one
// is currently selected. Pages come from the real OAuth grant stored on the
// connection (SocialAccount.meta) — never invented. Page access tokens are
// intentionally NOT returned. Only Facebook exposes a Page list to us today;
// other platforms have no equivalent, so we say so rather than fake an empty one.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const userName = sp.get("user");
  if (!userName) {
    return NextResponse.json({ success: false, error: "Provide ?user=<profile>" }, { status: 400 });
  }
  const platform = (sp.get("platform") ?? "facebook").toLowerCase();
  if (platform !== "facebook") {
    return NextResponse.json(
      { success: false, error: `Page listing is only available for facebook, not ${platform}` },
      { status: 400 }
    );
  }

  const profile = await db.profile.findUnique({
    where: { accountId_name: { accountId: auth.accountId, name: userName } },
  });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  const account = await db.socialAccount.findFirst({
    where: { profileId: profile.id, platform: "facebook" },
  });
  if (!account) {
    return NextResponse.json(
      { success: false, error: "No Facebook account connected for this profile" },
      { status: 404 }
    );
  }

  const meta = account.meta ? (JSON.parse(account.meta) as Partial<FacebookMeta>) : {};
  const connectedPageId = account.externalUserId;
  const pages = (meta.pages ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.id === connectedPageId,
  }));

  return NextResponse.json({
    success: true,
    user: profile.name,
    platform: "facebook",
    connected_page_id: connectedPageId,
    pages,
  });
}
