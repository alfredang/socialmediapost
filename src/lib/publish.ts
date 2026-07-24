import { db } from "./db";
import {
  adaptContent,
  validateMediaForPlatform,
  PLATFORM_MAP,
  PostType,
  AdaptInput,
} from "./platforms";
import { StoredFile } from "./upload";
import { REAL_PUBLISHERS, publicMediaUrl } from "./publishers";
import { ensureFreshToken } from "./token-refresh";
import { TokenExpiredError } from "./oauth-errors";

// A platform-specific content override: its own type + media, replacing the
// post's base type/media for that one platform.
export interface PlatformContent {
  type: PostType;
  media: StoredFile[];
}

export interface CreatePostInput {
  profileId: string;
  type: PostType;
  title: string;
  description: string;
  firstComment?: string;
  overrides?: Record<string, string>;
  platforms: string[];
  media: StoredFile[];
  // Per-platform content. A platform present here publishes its own type+media
  // instead of the base type/media above.
  perPlatform?: Record<string, PlatformContent>;
  scheduledAt?: Date | null;
  source?: string;
  draft?: boolean;
  idempotencyKey?: string | null;
}

// A stored pipeline item → the per-platform content map createPost expects.
// Its `perPlatform` JSON was sanitized when the item was created.
export function pipelineItemContent(item: {
  perPlatform: string;
}): Record<string, PlatformContent> {
  const raw = JSON.parse(item.perPlatform || "{}") as Record<string, { type: string; media: StoredFile[] }>;
  const out: Record<string, PlatformContent> = {};
  for (const [platform, pc] of Object.entries(raw)) {
    out[platform] = { type: pc.type as PostType, media: pc.media };
  }
  return out;
}

export async function createPost(input: CreatePostInput) {
  if (input.idempotencyKey) {
    const existing = await db.post.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { targets: true },
    });
    if (existing) return { post: existing, deduped: true };
  }

  const profile = await db.profile.findUnique({
    where: { id: input.profileId },
    include: { socialAccounts: true },
  });
  if (!profile) throw new Error("Profile not found");

  const status = input.draft ? "draft" : input.scheduledAt ? "scheduled" : "publishing";
  const post = await db.post.create({
    data: {
      profileId: input.profileId,
      type: input.type,
      title: input.title,
      description: input.description,
      firstComment: input.firstComment ?? "",
      mediaFiles: JSON.stringify(input.media),
      status,
      source: input.source ?? "api",
      scheduledAt: input.scheduledAt ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      targets: {
        create: input.platforms.map((platform) => {
          const pp = input.perPlatform?.[platform];
          const adapted = adaptContent(platform, {
            type: pp?.type ?? input.type,
            title: input.title,
            description: input.description,
            firstComment: input.firstComment,
            overrides: input.overrides,
          } satisfies AdaptInput);
          return {
            platform,
            adaptedTitle: adapted.title,
            adaptedBody: adapted.body,
            firstComment: adapted.firstComment,
            // Store the override only when this platform differs from the base.
            type: pp ? pp.type : null,
            mediaFiles: pp ? JSON.stringify(pp.media) : null,
            status: "pending",
          };
        }),
      },
    },
    include: { targets: true },
  });
  return { post, deduped: false };
}

// Publishes every pending target of a post through its platform adapter.
export async function publishPost(postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { targets: true, profile: { include: { socialAccounts: true, account: true } } },
  });
  if (!post) throw new Error("Post not found");

  await db.post.update({ where: { id: postId }, data: { status: "publishing" } });

  const connected = new Map(post.profile.socialAccounts.map((a) => [a.platform, a]));
  const results = [];

  for (const target of post.targets.filter((t) => t.status === "pending")) {
    const def = PLATFORM_MAP[target.platform];
    const account = connected.get(target.platform);
    try {
      if (!def) throw new Error(`Unknown platform "${target.platform}"`);
      if (!account) throw new Error(`No ${def.name} account connected to profile "${post.profile.name}"`);
      if (account.status === "needs_reauth") throw new Error(`${def.name} account requires re-authentication`);
      if (account.status === "pending_page") {
        throw new Error(`Choose a Facebook Page on the Users page to finish connecting this account`);
      }
      // Effective content for this platform: its own override, else the post base.
      const type = (target.type ?? post.type) as PostType;
      const media = (target.mediaFiles ? JSON.parse(target.mediaFiles) : JSON.parse(post.mediaFiles)) as StoredFile[];

      if (!def.supports.includes(type)) {
        throw new Error(`${def.name} does not support ${type} posts`);
      }

      const publisher = REAL_PUBLISHERS[target.platform];
      if (!publisher) {
        throw new Error(`${def.name} integration is not yet available`);
      }
      if (!account.accessToken || !account.externalUserId) {
        throw new Error(`${def.name} account isn't OAuth-connected — reconnect it on the Users page`);
      }

      validateMediaForPlatform(def, type, media);
      const fresh = await ensureFreshToken(account);
      const { url, externalId } = await publisher({
        account: fresh,
        type,
        media,
        mediaUrls: () => media.map(publicMediaUrl),
        caption: [target.adaptedTitle, target.adaptedBody].filter(Boolean).join("\n\n"),
        title: target.adaptedTitle,
        firstComment: target.firstComment,
      });
      await db.postTarget.update({
        where: { id: target.id },
        data: { status: "published", externalUrl: url, externalId, publishedAt: new Date(), error: null },
      });
      results.push({ platform: target.platform, success: true, url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      // Expired/revoked tokens flip the account so the UI prompts a reconnect.
      if (err instanceof TokenExpiredError && account) {
        await db.socialAccount
          .update({ where: { id: account.id }, data: { status: "needs_reauth" } })
          .catch(() => {});
      }
      await db.postTarget.update({
        where: { id: target.id },
        data: { status: "failed", error: message },
      });
      results.push({ platform: target.platform, success: false, error: message });
    }
  }

  const targets = await db.postTarget.findMany({ where: { postId } });
  const ok = targets.filter((t) => t.status === "published").length;
  const failed = targets.filter((t) => t.status === "failed").length;
  const finalStatus = failed === 0 ? "published" : ok === 0 ? "failed" : "partial";
  await db.post.update({ where: { id: postId }, data: { status: finalStatus } });

  const accountId = post.profile.accountId;
  await db.notification.create({
    data: {
      accountId,
      kind: failed === 0 ? "success" : "error",
      message: failed === 0
        ? `Post "${(post.title || post.description).slice(0, 40)}" published to ${ok} platform${ok === 1 ? "" : "s"}`
        : `Post "${(post.title || post.description).slice(0, 40)}": ${ok} published, ${failed} failed`,
    },
  });

  // Webhook delivery (fire and forget)
  const webhookUrl = post.profile.account.webhookUrl;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "post.completed",
        request_id: post.requestId,
        status: finalStatus,
        results,
      }),
    }).catch(() => {});
  }

  return { status: finalStatus, results };
}

export async function retryFailedTargets(postId: string) {
  await db.postTarget.updateMany({
    where: { postId, status: "failed" },
    data: { status: "pending", error: null },
  });
  return publishPost(postId);
}
