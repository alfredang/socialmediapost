import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { fetchPageDirect } from "@/lib/facebook";
import { CREDENTIAL_PLATFORM_SET } from "@/lib/platforms";
import { validateDiscordWebhook } from "@/lib/discord";
import { validateSlackWebhook } from "@/lib/slack";
import { validateTelegram } from "@/lib/telegram";
import { validateBluesky } from "@/lib/bluesky";
import { validateDevto } from "@/lib/devto";
import { validateHashnode } from "@/lib/hashnode";
import { validateWordPress } from "@/lib/wordpress";
import { validateMastodon } from "@/lib/mastodon";
import { validateListmonk } from "@/lib/listmonk";

// OAuth accounts are created via the real OAuth flows (/api/auth/<platform>).
// Webhook/credential platforms (Discord, Slack, Telegram) are connected here via
// POST: the pasted credential is validated against the platform before it's
// stored — no unverified credential is ever saved. `accessToken` holds the
// secret (webhook URL / bot token); `meta` holds any extras (chat/channel id).

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

  if (!CREDENTIAL_PLATFORM_SET.has(platform)) {
    return NextResponse.json(
      { success: false, error: "That platform isn't connected with a webhook/credential" },
      { status: 400 }
    );
  }
  const profile = await db.profile.findFirst({ where: { id: String(body.profileId ?? ""), accountId: auth } });
  if (!profile) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

  try {
    let data: { accessToken: string; handle: string; displayName: string; externalUserId: string; meta: string | null };
    if (platform === "discord") {
      const webhookUrl = String(body.webhookUrl ?? "").trim();
      const info = await validateDiscordWebhook(webhookUrl);
      data = {
        accessToken: webhookUrl,
        handle: info.name,
        displayName: info.name,
        externalUserId: info.id,
        meta: JSON.stringify({ channelId: info.channelId, guildId: info.guildId }),
      };
    } else if (platform === "slack") {
      const webhookUrl = String(body.webhookUrl ?? "").trim();
      await validateSlackWebhook(webhookUrl);
      const serviceId = webhookUrl.split("/services/")[1]?.split("/")[0] ?? "webhook";
      data = { accessToken: webhookUrl, handle: "Slack", displayName: "Slack channel", externalUserId: serviceId, meta: null };
    } else if (platform === "bluesky") {
      // handle + app password; the app password itself is the stored credential
      // (a fresh session is minted per publish).
      const appPassword = String(body.appPassword ?? "").trim();
      const info = await validateBluesky(String(body.handle ?? ""), appPassword);
      data = {
        accessToken: appPassword,
        handle: info.handle,
        displayName: `@${info.handle}`,
        externalUserId: info.did,
        meta: null,
      };
    } else if (platform === "devto") {
      const apiKey = String(body.apiKey ?? "").trim();
      const info = await validateDevto(apiKey);
      data = {
        accessToken: apiKey,
        handle: info.username,
        displayName: info.name,
        externalUserId: info.id,
        meta: null,
      };
    } else if (platform === "hashnode") {
      // The publication id is resolved at connect time and cached in meta —
      // publishPost requires it and the composer has nowhere to ask for it.
      const token = String(body.token ?? "").trim();
      const info = await validateHashnode(token);
      data = {
        accessToken: token,
        handle: info.username,
        displayName: info.publicationTitle,
        externalUserId: info.publicationId,
        meta: JSON.stringify({ publicationId: info.publicationId }),
      };
    } else if (platform === "wordpress") {
      // accessToken holds the application password; the site URL and username
      // it authenticates against go in meta.
      const appPassword = String(body.appPassword ?? "").trim();
      const username = String(body.username ?? "").trim();
      const info = await validateWordPress(String(body.siteUrl ?? ""), username, appPassword);
      data = {
        accessToken: appPassword,
        handle: username,
        displayName: `${info.displayName} (${new URL(info.site).host})`,
        externalUserId: info.userId,
        meta: JSON.stringify({ site: info.site, username }),
      };
    } else if (platform === "mastodon") {
      // Per-instance limits are captured now so the publisher doesn't have to
      // re-discover them on every post.
      const accessToken = String(body.accessToken ?? "").trim();
      const info = await validateMastodon(String(body.instanceUrl ?? ""), accessToken);
      data = {
        accessToken,
        handle: info.acct,
        displayName: `@${info.acct}@${new URL(info.instance).host}`,
        externalUserId: info.userId,
        meta: JSON.stringify({ instance: info.instance, limits: info.limits }),
      };
    } else if (platform === "listmonk") {
      const apiToken = String(body.apiToken ?? "").trim();
      const apiUser = String(body.apiUser ?? "").trim();
      const info = await validateListmonk(
        String(body.baseUrl ?? ""),
        apiUser,
        apiToken,
        String(body.listId ?? "")
      );
      data = {
        accessToken: apiToken,
        handle: apiUser,
        displayName: `${info.listName} (${new URL(info.base).host})`,
        externalUserId: String(info.listId),
        meta: JSON.stringify({ base: info.base, apiUser, listId: info.listId }),
      };
    } else {
      // telegram — bot token + channel/chat id
      const botToken = String(body.botToken ?? "").trim();
      const chatId = String(body.chatId ?? "").trim();
      const info = await validateTelegram(botToken, chatId);
      data = {
        accessToken: botToken,
        handle: info.chatTitle,
        displayName: info.chatTitle,
        externalUserId: info.botId,
        meta: JSON.stringify({ chatId }),
      };
    }

    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: profile.id, platform } },
      update: { ...data, status: "connected" },
      create: { profileId: profile.id, platform, status: "connected", ...data },
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
