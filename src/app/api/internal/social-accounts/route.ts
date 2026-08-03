import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { fetchPageDirect } from "@/lib/facebook";
import { CREDENTIAL_VALIDATORS } from "@/lib/credential-connect";

// OAuth accounts are created via the real OAuth flows (/api/auth/<platform>).
// Credential platforms are connected here via POST: the pasted credential is
// validated against the platform before it's stored — no unverified credential
// is ever saved. `accessToken` holds the secret (webhook URL / token / app
// password); `meta` holds any extras (chat id, instance URL, list id).
//
// The per-platform logic lives in lib/credential-connect.ts, which is
// exhaustive against CREDENTIAL_PLATFORMS at compile time.

// POST — connect a credential-based platform.
//   Discord/Slack: { profileId, platform, webhookUrl }
//   Telegram:      { profileId, platform, botToken, chatId }
//   Bluesky:       { profileId, platform, handle, appPassword }
//   Dev.to:        { profileId, platform, apiKey }
//   Hashnode:      { profileId, platform, token }
//   WordPress:     { profileId, platform, siteUrl, username, appPassword }
//   Mastodon:      { profileId, platform, instanceUrl, accessToken }
//   Listmonk:      { profileId, platform, baseUrl, apiUser, apiToken, listId }
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").toLowerCase();

  // The registry is the membership test: a platform with no validator is, by
  // definition, not credential-connected.
  const validate = CREDENTIAL_VALIDATORS[platform];
  if (!validate) {
    return NextResponse.json(
      { success: false, error: "That platform isn't connected with a webhook/credential" },
      { status: 400 }
    );
  }
  const profile = await db.profile.findFirst({ where: { id: String(body.profileId ?? ""), accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  try {
    const data = await validate(body);

    // The validator's result is spread FIRST so it can never override the
    // ownership-checked profileId or the resolved platform — those are ours to
    // decide, not a validator's, and putting them last keeps a cross-tenant
    // write impossible even if a validator ever returns unexpected keys.
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: profile.id, platform } },
      update: { ...data, status: "connected" },
      create: { ...data, profileId: profile.id, platform, status: "connected" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not connect that credential" },
      { status: 400 }
    );
  }
}

// PATCH — fix a needs_reauth account, or { id, pageId } to finish a Facebook
// connection by picking which managed Page to publish to.
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const account = await db.socialAccount.findFirst({
    where: { id: body.id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (body.pageId) {
    if (account.platform !== "facebook" || !account.meta) {
      return NextResponse.json({ success: false, error: "Not a Facebook connection" }, { status: 400 });
    }
    const meta = JSON.parse(account.meta) as {
      userToken?: string;
      pages?: { id: string; name: string; access_token: string }[];
    };
    let page = meta.pages?.find((p) => p.id === body.pageId);
    if (!page && meta.userToken) {
      // /me/accounts came back empty for this account — resolve the Page
      // directly by ID with the stored user token.
      try {
        page = await fetchPageDirect(meta.userToken, String(body.pageId).trim());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not access that Page";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    }
    if (!page) return NextResponse.json({ success: false, error: "Page not found" }, { status: 404 });
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        handle: page.name,
        displayName: page.name,
        externalUserId: page.id,
        accessToken: page.access_token,
        status: "connected",
      },
    });
    return NextResponse.json({ success: true });
  }

  // A needs_reauth account cannot be "fixed" by flipping the flag: the stored
  // token is expired or revoked, so marking it connected would only make the
  // UI lie until the next publish failed. Reconnecting via OAuth is the fix.
  return NextResponse.json(
    {
      success: false,
      error: `Reconnect this ${account.platform} account to get a fresh token — its previous authorization is no longer valid.`,
      reconnect: true,
      platform: account.platform,
    },
    { status: 409 }
  );
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const account = await db.socialAccount.findFirst({
    where: { id: id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.socialAccount.delete({ where: { id: account.id } });
  return NextResponse.json({ success: true });
}
