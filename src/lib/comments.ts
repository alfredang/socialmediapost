// Shared comment read/reply logic for both the public API (Apikey auth) and the
// internal dashboard route (session auth). Facebook and Instagram only — the two
// connected platforms whose stored token can read/reply. Comments are normalized
// to one shape so callers never special-case FB's `message`/`from` vs IG's
// `text`/`username`. Nothing here is ever faked: a platform with no data or no
// integration returns an explicit error, not an empty list.
import { db } from "./db";
import { ensureFreshToken } from "./token-refresh";
import { TokenExpiredError, MissingPermissionError } from "./oauth-errors";
import { fetchPostComments, replyToComment } from "./facebook";
import { fetchMediaComments, replyToIgComment } from "./instagram";

export const SUPPORTED_COMMENT_PLATFORMS = ["facebook", "instagram"] as const;

export interface NormalizedComment {
  id: string;
  message: string;
  author: string | null;
  created_at: string | null;
  likes: number | null;
}

export interface CommentError {
  status: number;
  error: string;
  reconnect?: boolean;
}

export interface ResolvedTarget {
  objectId: string;
  token: string;
}

export function isCommentError(x: ResolvedTarget | CommentError): x is CommentError {
  return "status" in x;
}

export function normalizeCommentPlatform(value: string | null | undefined): string | CommentError {
  const platform = (value ?? "facebook").toLowerCase();
  if (!SUPPORTED_COMMENT_PLATFORMS.includes(platform as (typeof SUPPORTED_COMMENT_PLATFORMS)[number])) {
    return {
      status: 400,
      error: `Comments are only available for ${SUPPORTED_COMMENT_PLATFORMS.join(" and ")}, not ${platform}`,
    };
  }
  return platform;
}

// Locates the post (scoped to the account), its published target for `platform`,
// and a fresh token — or an error describing exactly what is missing.
export async function resolveCommentTarget(
  accountId: string,
  requestId: string,
  platform: string
): Promise<ResolvedTarget | CommentError> {
  const post = await db.post.findFirst({
    where: { requestId, profile: { accountId } },
    include: { targets: true, profile: { include: { socialAccounts: true } } },
  });
  if (!post) return { status: 404, error: "Post not found" };

  const target = post.targets.find((t) => t.platform === platform);
  if (!target || target.status !== "published" || !target.externalId) {
    return { status: 400, error: `This post is not published to ${platform} yet` };
  }

  const account = post.profile.socialAccounts.find((a) => a.platform === platform);
  if (!account?.accessToken) {
    return {
      status: 409,
      error: `${platform} account isn't connected — reconnect it on the Users page`,
      reconnect: true,
    };
  }

  // Facebook post ids are `{pageId}_{postId}`. Reading/replying needs the token
  // of the Page that OWNS the post; a token for a different Page fails with the
  // opaque Graph #100/subcode-33 "does not support this operation". If the
  // connected Page no longer matches the post's owner (common after reconnecting
  // to a different Page), say so precisely instead of letting Graph reject it.
  if (platform === "facebook" && target.externalId.includes("_")) {
    const ownerPageId = target.externalId.split("_")[0];
    if (account.externalUserId && ownerPageId !== account.externalUserId) {
      return {
        status: 409,
        error:
          "This post belongs to a different Facebook Page than the one currently connected. Reconnect and select the Page that published it.",
        reconnect: true,
      };
    }
  }

  const fresh = await ensureFreshToken(account);
  return { objectId: target.externalId, token: fresh.accessToken! };
}

export interface CommentsResult {
  comments: NormalizedComment[];
  // Platform's own total comment count for the object, when it exposes one.
  // Lets callers tell "no comments" from "comments withheld from the read".
  count: number | null;
}

export async function readComments(
  platform: string,
  objectId: string,
  token: string
): Promise<CommentsResult> {
  if (platform === "facebook") {
    const rows = await fetchPostComments(objectId, token);
    return {
      count: null,
      comments: rows.map((c) => ({
        id: c.id,
        message: c.message,
        author: c.from?.name ?? null,
        created_at: c.createdTime ?? null,
        likes: c.likeCount ?? null,
      })),
    };
  }
  const { comments, count } = await fetchMediaComments(objectId, token);
  return {
    count,
    comments: comments.map((c) => ({
      id: c.id,
      message: c.text,
      author: c.username ?? null,
      created_at: c.timestamp ?? null,
      likes: c.likeCount ?? null,
    })),
  };
}

export function replyToPlatformComment(
  platform: string,
  commentId: string,
  message: string,
  token: string
): Promise<{ id: string }> {
  return platform === "facebook"
    ? replyToComment(commentId, message, token)
    : replyToIgComment(commentId, message, token);
}

export function graphErrorInfo(err: unknown): CommentError {
  if (err instanceof TokenExpiredError) {
    return { status: 409, error: "Authorization expired — reconnect the account", reconnect: true };
  }
  if (err instanceof MissingPermissionError) {
    return { status: 409, error: err.message, reconnect: true };
  }
  return { status: 502, error: err instanceof Error ? err.message : "Platform API error" };
}
