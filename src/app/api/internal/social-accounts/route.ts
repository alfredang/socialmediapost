import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { fetchPageDirect } from "@/lib/facebook";
import { CREDENTIAL_PLATFORM_SET } from "@/lib/platforms";
import { validateDiscordWebhook } from "@/lib/discord";
import { validateSlackWebhook } from "@/lib/slack";

// OAuth accounts are created via the real OAuth flows (/api/auth/<platform>).
// Webhook/credential platforms (Discord, Slack) are connected here via POST:
// the pasted credential is validated against the platform before it's stored —
// no unverified credential is ever saved.

// POST — connect a credential-based platform: { profileId, platform, webhookUrl }.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").toLowerCase();
  const webhookUrl = String(body.webhookUrl ?? "").trim();

  if (!CREDENTIAL_PLATFORM_SET.has(platform)) {
    return NextResponse.json(
      { success: false, error: "That platform isn't connected with a webhook/credential" },
      { status: 400 }
    );
  }
  const profile = await db.profile.findFirst({ where: { id: String(body.profileId ?? ""), accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  try {
    let data: { handle: string; displayName: string; externalUserId: string; meta: string | null };
    if (platform === "discord") {
      const info = await validateDiscordWebhook(webhookUrl);
      data = {
        handle: info.name,
        displayName: info.name,
        externalUserId: info.id,
        meta: JSON.stringify({ channelId: info.channelId, guildId: info.guildId }),
      };
    } else {
      // slack
      await validateSlackWebhook(webhookUrl);
      const serviceId = webhookUrl.split("/services/")[1]?.split("/")[0] ?? "webhook";
      data = { handle: "Slack", displayName: "Slack channel", externalUserId: serviceId, meta: null };
    }

    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: profile.id, platform } },
      update: { ...data, accessToken: webhookUrl, status: "connected" },
      create: { profileId: profile.id, platform, accessToken: webhookUrl, status: "connected", ...data },
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
