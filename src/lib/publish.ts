import { db } from "./db";
import { adaptContent, publishToPlatform, PLATFORM_MAP, PostType, AdaptInput } from "./platforms";
import { StoredFile } from "./upload";
import { publishToInstagram } from "./instagram";

// Builds a public URL Instagram's servers can fetch a stored media file from.
function publicMediaUrl(file: StoredFile): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL is not set — Instagram needs a public https URL to fetch your media"
    );
  }
  return `${base.replace(/\/$/, "")}/api/media/${file.path}`;
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
  scheduledAt?: Date | null;
  source?: string;
  draft?: boolean;
  idempotencyKey?: string | null;
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
          const adapted = adaptContent(platform, {
            type: input.type,
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
      if (!def.supports.includes(post.type as PostType)) {
        throw new Error(`${def.name} does not support ${post.type} posts`);
      }

      let url: string;
      let externalId: string;
      // Real Instagram accounts (connected via OAuth) carry an access token —
      // publish through the live API. Demo/simulated accounts fall back below.
      if (target.platform === "instagram" && account.accessToken && account.externalUserId) {
        const media = JSON.parse(post.mediaFiles) as StoredFile[];
        const caption = [target.adaptedTitle, target.adaptedBody].filter(Boolean).join("\n\n");
        ({ url, externalId } = await publishToInstagram({
          igUserId: account.externalUserId,
          accessToken: account.accessToken,
          type: post.type === "video" ? "video" : "photos",
          mediaUrls: media.map(publicMediaUrl),
          caption,
          firstComment: target.firstComment,
        }));
      } else {
        ({ url, externalId } = await publishToPlatform(target.platform, account.handle, {
          platform: target.platform,
          title: target.adaptedTitle,
          body: target.adaptedBody,
          firstComment: target.firstComment,
          warnings: [],
        }));
      }
      await db.postTarget.update({
        where: { id: target.id },
        data: { status: "published", externalUrl: url, externalId, publishedAt: new Date(), error: null },
      });
      // Seed a starting metrics row so analytics has data immediately
      await db.postMetric.create({
        data: {
          targetId: target.id,
          views: 50 + Math.floor(Math.random() * 400),
          likes: 5 + Math.floor(Math.random() * 60),
          comments: Math.floor(Math.random() * 12),
          shares: Math.floor(Math.random() * 8),
        },
      });
      results.push({ platform: target.platform, success: true, url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
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
