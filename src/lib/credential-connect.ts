// Registry of credential-platform validators — the connect-time counterpart to
// REAL_PUBLISHERS in publishers.ts.
//
// This replaced an if/else chain in the social-accounts route whose final
// `else` assumed Telegram. That meant adding a platform to CREDENTIAL_PLATFORMS
// and forgetting its branch didn't fail: the request silently fell through and
// tried to validate the credential as a Telegram bot token. `satisfies` below
// makes that a compile error instead.
//
// Every validator must PROVE the credential against the real platform before it
// is stored — no unverified credential is ever written to the database.

import { CredentialPlatform } from "./platforms";
import { validateDiscordWebhook } from "./discord";
import { validateSlackWebhook } from "./slack";
import { validateTelegram } from "./telegram";
import { validateBluesky } from "./bluesky";
import { validateDevto } from "./devto";
import { validateHashnode } from "./hashnode";
import { validateWordPress } from "./wordpress";
import { validateMastodon } from "./mastodon";
import { validateListmonk } from "./listmonk";

/** The SocialAccount columns a successful connect fills in. */
export interface ConnectedAccount {
  accessToken: string; // the secret: webhook URL, token, or app password
  handle: string;
  displayName: string;
  externalUserId: string;
  meta: string | null; // JSON platform extras (instance URL, list id, …)
}

export type CredentialValidator = (body: Record<string, unknown>) => Promise<ConnectedAccount>;

/** Trimmed string field from the request body. */
const str = (body: Record<string, unknown>, key: string) => String(body[key] ?? "").trim();

const VALIDATORS = {
  discord: async (body) => {
    const webhookUrl = str(body, "webhookUrl");
    const info = await validateDiscordWebhook(webhookUrl);
    return {
      accessToken: webhookUrl,
      handle: info.name,
      displayName: info.name,
      externalUserId: info.id,
      meta: JSON.stringify({ channelId: info.channelId, guildId: info.guildId }),
    };
  },

  slack: async (body) => {
    const webhookUrl = str(body, "webhookUrl");
    await validateSlackWebhook(webhookUrl);
    const serviceId = webhookUrl.split("/services/")[1]?.split("/")[0] ?? "webhook";
    return {
      accessToken: webhookUrl,
      handle: "Slack",
      displayName: "Slack channel",
      externalUserId: serviceId,
      meta: null,
    };
  },

  telegram: async (body) => {
    const botToken = str(body, "botToken");
    const chatId = str(body, "chatId");
    const info = await validateTelegram(botToken, chatId);
    return {
      accessToken: botToken,
      handle: info.chatTitle,
      displayName: info.chatTitle,
      externalUserId: info.botId,
      meta: JSON.stringify({ chatId }),
    };
  },

  bluesky: async (body) => {
    // The app password itself is the stored credential — a fresh session is
    // minted per publish.
    const appPassword = str(body, "appPassword");
    const info = await validateBluesky(str(body, "handle"), appPassword);
    return {
      accessToken: appPassword,
      handle: info.handle,
      displayName: `@${info.handle}`,
      externalUserId: info.did,
      meta: null,
    };
  },

  devto: async (body) => {
    const apiKey = str(body, "apiKey");
    const info = await validateDevto(apiKey);
    return {
      accessToken: apiKey,
      handle: info.username,
      displayName: info.name,
      externalUserId: info.id,
      meta: null,
    };
  },

  hashnode: async (body) => {
    // The publication id is resolved now and cached: publishPost requires it
    // and the composer has nowhere to ask for it.
    const token = str(body, "token");
    const info = await validateHashnode(token);
    return {
      accessToken: token,
      handle: info.username,
      displayName: info.publicationTitle,
      externalUserId: info.publicationId,
      meta: JSON.stringify({ publicationId: info.publicationId }),
    };
  },

  wordpress: async (body) => {
    // accessToken holds the application password; the site and username it
    // authenticates against go in meta.
    const appPassword = str(body, "appPassword");
    const username = str(body, "username");
    const info = await validateWordPress(str(body, "siteUrl"), username, appPassword);
    return {
      accessToken: appPassword,
      handle: username,
      displayName: `${info.displayName} (${new URL(info.site).host})`,
      externalUserId: info.userId,
      meta: JSON.stringify({ site: info.site, username }),
    };
  },

  mastodon: async (body) => {
    // Per-instance limits are captured now so the publisher doesn't re-discover
    // them on every post.
    const accessToken = str(body, "accessToken");
    const info = await validateMastodon(str(body, "instanceUrl"), accessToken);
    return {
      accessToken,
      handle: info.acct,
      displayName: `@${info.acct}@${new URL(info.instance).host}`,
      externalUserId: info.userId,
      meta: JSON.stringify({ instance: info.instance, limits: info.limits }),
    };
  },

  listmonk: async (body) => {
    const apiToken = str(body, "apiToken");
    const apiUser = str(body, "apiUser");
    const info = await validateListmonk(
      str(body, "baseUrl"),
      apiUser,
      apiToken,
      str(body, "listId")
    );
    return {
      accessToken: apiToken,
      handle: apiUser,
      displayName: `${info.listName} (${new URL(info.base).host})`,
      externalUserId: String(info.listId),
      meta: JSON.stringify({ base: info.base, apiUser, listId: info.listId }),
    };
  },
} satisfies Record<CredentialPlatform, CredentialValidator>;

// String-keyed for callers holding an unvalidated platform id; a miss means the
// platform isn't credential-connected.
//
// NULL PROTOTYPE, deliberately. The key comes straight from a request body, and
// a plain object literal would resolve inherited names: `platform=constructor`
// returns the Object constructor, which is truthy and callable, so it passes a
// `if (!validate)` guard and then `await Object(body)` hands the caller the raw
// request as if it were a validated result. Hardening the object rather than
// the call site means a future consumer cannot reintroduce the hole by
// forgetting a guard. Do not spread this into a plain object.
export const CREDENTIAL_VALIDATORS: Record<string, CredentialValidator> = Object.assign(
  Object.create(null),
  VALIDATORS
);
