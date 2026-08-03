// Registry of real platform publishers. publishPost fails a target with a
// clear error when its platform has no entry here or its SocialAccount lacks
// an OAuth token — there is no simulated fallback.

import type { SocialAccount } from "@prisma/client";
import { PostType, ConnectablePlatform } from "./platforms";
import { StoredFile } from "./upload";
import { publishToInstagram } from "./instagram";
import { publishToFacebook } from "./facebook";
import { publishToLinkedIn } from "./linkedin";
import { publishToTikTok } from "./tiktok";
import { publishToDiscord } from "./discord";
import { publishToSlack } from "./slack";
import { publishToYouTube } from "./youtube";
import { publishToTelegram } from "./telegram";
import { publishToThreads } from "./threads";
import { publishToBluesky } from "./bluesky";
import { publishToDevto } from "./devto";
import { publishToHashnode } from "./hashnode";
import { publishToWordPress } from "./wordpress";
import { publishToMastodon } from "./mastodon";
import { publishToListmonk } from "./listmonk";

// Builds a public URL a platform's servers can fetch a stored media file from.
// Media-URL stubs (mime "url") are already public — pass them through.
export function publicMediaUrl(file: StoredFile): string {
  if (file.mime === "url") return file.name;
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL is not set — this platform needs a public https URL to fetch your media"
    );
  }
  return `${base.replace(/\/$/, "")}/api/media/${file.path}`;
}

export interface PublishContext {
  account: SocialAccount; // token-fresh account (externalUserId + accessToken set)
  type: PostType;
  media: StoredFile[];
  mediaUrls: () => string[]; // lazy — only demands PUBLIC_BASE_URL when actually used
  caption: string; // adapted title + body
  title: string; // adapted title alone (media card titles / video titles)
  body: string; // adapted body alone (e.g. YouTube description, kept apart from the title)
  firstComment: string;
}

export type PlatformPublisher = (
  ctx: PublishContext
) => Promise<{ url: string; externalId: string }>;

// `satisfies` keeps this exhaustive against the platforms.ts connect lists in
// both directions: a connectable platform with no publisher here fails to
// compile, and so does a publisher for a platform the UI never offers.
const PUBLISHERS = {
  instagram: (ctx) =>
    publishToInstagram({
      igUserId: ctx.account.externalUserId!,
      accessToken: ctx.account.accessToken!,
      type: ctx.type === "video" ? "video" : "photos",
      mediaUrls: ctx.mediaUrls(),
      caption: ctx.caption,
      firstComment: ctx.firstComment,
    }),
  facebook: (ctx) =>
    publishToFacebook({
      pageId: ctx.account.externalUserId!,
      pageToken: ctx.account.accessToken!,
      type: ctx.type as "video" | "photos" | "text",
      mediaUrls: ctx.type === "text" ? [] : ctx.mediaUrls(),
      message: ctx.caption,
      firstComment: ctx.firstComment,
    }),
  linkedin: (ctx) =>
    publishToLinkedIn({
      personId: ctx.account.externalUserId!,
      accessToken: ctx.account.accessToken!,
      type: ctx.type,
      media: ctx.media,
      commentary: ctx.caption,
      title: ctx.title,
      firstComment: ctx.firstComment,
    }),
  tiktok: (ctx) =>
    publishToTikTok({
      accessToken: ctx.account.accessToken!,
      handle: ctx.account.handle,
      type: ctx.type as "video" | "photos",
      media: ctx.media,
      mediaUrls: ctx.type === "photos" ? ctx.mediaUrls() : [],
      caption: ctx.caption,
    }),
  // Webhook platforms: accessToken holds the webhook URL (no OAuth). readStoredFile
  // pulls bytes for attachments, so no PUBLIC_BASE_URL is needed.
  discord: (ctx) =>
    publishToDiscord({
      webhookUrl: ctx.account.accessToken!,
      meta: ctx.account.meta,
      type: ctx.type,
      media: ctx.media,
      content: ctx.caption,
    }),
  slack: (ctx) =>
    publishToSlack({
      webhookUrl: ctx.account.accessToken!,
      text: ctx.caption,
    }),
  telegram: (ctx) =>
    publishToTelegram({
      token: ctx.account.accessToken!,
      chatId: JSON.parse(ctx.account.meta || "{}").chatId,
      type: ctx.type,
      media: ctx.media,
      text: ctx.caption,
    }),
  // YouTube: a titled platform — title and description stay separate.
  youtube: (ctx) =>
    publishToYouTube({
      accessToken: ctx.account.accessToken!,
      video: ctx.media[0],
      title: ctx.title,
      description: ctx.body,
    }),
  threads: (ctx) =>
    publishToThreads({
      userId: ctx.account.externalUserId!,
      accessToken: ctx.account.accessToken!,
      type: ctx.type as "video" | "photos" | "text",
      mediaUrls: ctx.type === "text" ? [] : ctx.mediaUrls(),
      text: ctx.caption,
    }),
  // Bluesky: app password in accessToken, did/handle in meta. Blobs upload as
  // raw bytes, so no PUBLIC_BASE_URL is needed.
  bluesky: (ctx) =>
    publishToBluesky({
      appPassword: ctx.account.accessToken!,
      did: ctx.account.externalUserId!,
      handle: ctx.account.handle,
      type: ctx.type,
      media: ctx.media,
      text: ctx.caption,
    }),
  // Blog platforms — all titleRole "titled", so the title and body stay apart
  // rather than being folded into one caption.
  devto: (ctx) =>
    publishToDevto({
      apiKey: ctx.account.accessToken!,
      title: ctx.title,
      bodyMarkdown: ctx.body,
    }),
  hashnode: (ctx) =>
    publishToHashnode({
      token: ctx.account.accessToken!,
      publicationId: JSON.parse(ctx.account.meta || "{}").publicationId,
      title: ctx.title,
      contentMarkdown: ctx.body,
    }),
  wordpress: (ctx) => {
    // meta carries the normalised site URL and username; accessToken is the
    // application password.
    const meta = JSON.parse(ctx.account.meta || "{}") as { site?: string; username?: string };
    return publishToWordPress({
      site: meta.site ?? "",
      username: meta.username ?? "",
      appPassword: ctx.account.accessToken!,
      type: ctx.type,
      media: ctx.media,
      title: ctx.title,
      body: ctx.body,
    });
  },
  // Self-hosted / federated platforms: the instance URL lives in meta, the
  // secret in accessToken.
  mastodon: (ctx) => {
    const meta = JSON.parse(ctx.account.meta || "{}");
    return publishToMastodon({
      instance: meta.instance ?? "",
      token: ctx.account.accessToken!,
      type: ctx.type,
      media: ctx.media,
      text: ctx.caption,
      limits: meta.limits,
    });
  },
  listmonk: (ctx) => {
    const meta = JSON.parse(ctx.account.meta || "{}");
    return publishToListmonk({
      base: meta.base ?? "",
      apiUser: meta.apiUser ?? "",
      token: ctx.account.accessToken!,
      listId: Number(meta.listId),
      subject: ctx.title,
      body: ctx.body,
    });
  },
} satisfies Record<ConnectablePlatform, PlatformPublisher>;

export const REAL_PUBLISHERS: Record<string, PlatformPublisher> = PUBLISHERS;
