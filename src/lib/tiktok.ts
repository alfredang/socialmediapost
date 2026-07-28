// TikTok publishing via the Content Posting API (open.tiktokapis.com/v2).
//
// Videos are PUSHED with a chunked FILE_UPLOAD (PULL_FROM_URL would require
// verifying the media domain with TikTok); photo posts use PULL_FROM_URL and
// therefore need PUBLIC_BASE_URL *and* the domain verified in the TikTok app.
// Access tokens last only 24h with a 365-day refresh token — publishing relies
// on ensureFreshToken() refreshing before each publish.
//
// Unaudited TikTok apps may only post with SELF_ONLY (private) visibility; the
// publisher reads the creator's allowed privacy options instead of hard-coding
// PUBLIC. Create an app at https://developers.tiktok.com with the Login Kit +
// Content Posting API products, put the client key/secret in
// TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET and add
// {origin}/api/auth/tiktok/callback as a redirect URI.

import { createHash, randomBytes } from "crypto";
import { appBaseUrl } from "./base-url";
import { StoredFile, readStoredFile } from "./upload";
import { TokenExpiredError } from "./oauth-errors";

const API = "https://open.tiktokapis.com/v2";
// Overridable for debugging scope grants (e.g. TIKTOK_SCOPES=user.info.basic
// to test Login Kit alone before Content Posting API is granted).
// user.info.stats and video.list are what make the analytics sync able to read
// follower and per-video numbers; publishing works without them.
function scopes(): string {
  return (
    process.env.TIKTOK_SCOPES ??
    "user.info.basic,user.info.stats,video.publish,video.list"
  );
}

// Cookie carrying the PKCE verifier between the start route and the callback.
export const PKCE_COOKIE = "tt_code_verifier";

// Platform extras stored in SocialAccount.meta for TikTok connections.
export interface TikTokMeta {
  refreshExpiresAt: string; // ISO date the refresh token itself dies (365d)
}

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  // Pre-review TikTok apps only accept localhost redirect URIs, which
  // PUBLIC_BASE_URL (tunnel) would break — TIKTOK_REDIRECT_BASE overrides it
  // (e.g. http://localhost:3000). Remove after app review approves the domain.
  const base = process.env.TIKTOK_REDIRECT_BASE ?? appBaseUrl(origin);
  return `${base.replace(/\/$/, "")}/api/auth/tiktok/callback`;
}

// TikTok requires PKCE. Quirk: the code_challenge is the HEX-encoded SHA256 of
// the verifier — not the base64url encoding standard OAuth PKCE uses.
export function authorizeRedirect(
  origin: string,
  state: string
): { url: string; cookies: { name: string; value: string }[] } {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString(), cookies: [{ name: PKCE_COOKIE, value: verifier }] };
}

export interface TikTokTokens {
  access_token: string;
  expires_in: number; // ~24h
  refresh_token: string;
  refresh_expires_in: number; // ~365d
  open_id: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "TikTok token exchange failed");
  }
  return data;
}

export async function exchangeCodeForToken(
  origin: string,
  code: string,
  codeVerifier: string
): Promise<TikTokTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    code_verifier: codeVerifier,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// Note: only fields covered by user.info.basic — requesting e.g. `username`
// (needs user.info.profile scope) makes TikTok reject the whole call.
export async function fetchProfile(
  accessToken: string
): Promise<{ open_id: string; display_name: string }> {
  const url = new URL(`${API}/user/info/`);
  url.searchParams.set("fields", "open_id,display_name");
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok || !data.data?.user) {
    throw new Error(data.error?.message || "Failed to read TikTok profile");
  }
  return data.data.user;
}

// All Content Posting responses share an { data, error: { code, message } }
// envelope where code "ok" means success.
async function ttPost(accessToken: string, path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const code = data.error?.code ?? "ok";
  if (code !== "ok") {
    if (code === "access_token_invalid" || res.status === 401) throw new TokenExpiredError("TikTok");
    throw new Error(data.error?.message || `TikTok API error (${path}: ${code})`);
  }
  return data.data;
}

// Pick the most public level the creator is allowed. Unaudited apps may only
// post SELF_ONLY — never fall back to an intermediate level like
// FOLLOWER_OF_CREATOR, which trips the "integration guidelines" rejection.
async function pickPrivacyLevel(accessToken: string): Promise<string> {
  const info = await ttPost(accessToken, "/post/publish/creator_info/query/", {});
  const options: string[] = info?.privacy_level_options ?? [];
  return options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
}

const SINGLE_CHUNK_MAX = 64 * 1024 * 1024; // files up to 64MB upload as one chunk
const CHUNK_SIZE = 10 * 1024 * 1024;

async function uploadVideoChunks(uploadUrl: string, bytes: Buffer, mime: string) {
  const total = bytes.length;
  // TikTok chunk math: total_chunk_count = floor(size/chunk_size) and the
  // remainder MERGES INTO THE FINAL CHUNK (never a short extra chunk).
  const chunkSize = total <= SINGLE_CHUNK_MAX ? total : CHUNK_SIZE;
  const chunkCount = total <= SINGLE_CHUNK_MAX ? 1 : Math.floor(total / chunkSize);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = i === chunkCount - 1 ? total - 1 : start + chunkSize - 1;
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": mime || "video/mp4",
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${total}`,
      },
      body: new Uint8Array(bytes.subarray(start, end + 1)),
    });
    if (!res.ok) throw new Error(`TikTok video upload failed (chunk ${i + 1}, ${res.status})`);
  }
}

// Poll until TikTok finishes processing the upload (mirrors IG's container poll).
async function waitForPublish(accessToken: string, publishId: string): Promise<string | null> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const status = await ttPost(accessToken, "/post/publish/status/fetch/", {
      publish_id: publishId,
    });
    if (status.status === "PUBLISH_COMPLETE") {
      // sic — TikTok's actual field name is misspelled
      return status.publicaly_available_post_id?.[0] ?? null;
    }
    if (status.status === "FAILED") {
      throw new Error(`TikTok publish failed (${status.fail_reason ?? "unknown reason"})`);
    }
    if (Date.now() > deadline) {
      throw new Error("TikTok is still processing the post — retry shortly to check the result");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// ── Analytics ──────────────────────────────────────────────────────────────
// Requires the user.info.stats / video.list scopes. Connections authorized
// before those scopes existed simply return nothing here — the sync records no
// numbers rather than inventing them.

export interface TtAccountMetrics {
  followers?: number;
  likes?: number;
}

export async function fetchAccountMetrics(accessToken: string): Promise<TtAccountMetrics> {
  const url = new URL(`${API}/user/info/`);
  url.searchParams.set("fields", "follower_count,likes_count");
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (data.error?.code === "access_token_invalid") throw new TokenExpiredError("TikTok");
  const user = data.data?.user;
  if (!res.ok || !user) return {};

  const out: TtAccountMetrics = {};
  if (typeof user.follower_count === "number") out.followers = user.follower_count;
  if (typeof user.likes_count === "number") out.likes = user.likes_count;
  return out;
}

export interface TtVideoMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export async function fetchVideoMetrics(
  accessToken: string,
  videoId: string
): Promise<TtVideoMetrics> {
  const res = await fetch(
    `${API}/video/query/?fields=id,view_count,like_count,comment_count,share_count`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ filters: { video_ids: [videoId] } }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (data.error?.code === "access_token_invalid") throw new TokenExpiredError("TikTok");
  const video = data.data?.videos?.[0];
  if (!res.ok || !video) return {};

  const out: TtVideoMetrics = {};
  if (typeof video.view_count === "number") out.views = video.view_count;
  if (typeof video.like_count === "number") out.likes = video.like_count;
  if (typeof video.comment_count === "number") out.comments = video.comment_count;
  if (typeof video.share_count === "number") out.shares = video.share_count;
  return out;
}

export interface TtPublishInput {
  accessToken: string;
  handle: string;
  type: "video" | "photos";
  media: StoredFile[];
  mediaUrls: string[]; // public https URLs, photos only (PULL_FROM_URL)
  caption: string;
}

// Publishes a video (chunked direct upload) or photo post (pulled from
// PUBLIC_BASE_URL) and returns the live URL + post/publish id.
export async function publishToTikTok(
  input: TtPublishInput
): Promise<{ url: string; externalId: string }> {
  const { accessToken, handle, type, media, mediaUrls, caption } = input;
  const privacy = await pickPrivacyLevel(accessToken);

  let publishId: string;
  if (type === "video") {
    const bytes = await readStoredFile(media[0]);
    const total = bytes.length;
    const single = total <= SINGLE_CHUNK_MAX;
    const init = await ttPost(accessToken, "/post/publish/video/init/", {
      post_info: { title: caption, privacy_level: privacy },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: total,
        chunk_size: single ? total : CHUNK_SIZE,
        total_chunk_count: single ? 1 : Math.floor(total / CHUNK_SIZE),
      },
    });
    await uploadVideoChunks(init.upload_url, bytes, media[0].mime);
    publishId = init.publish_id;
  } else {
    // Photo posts can only PULL_FROM_URL — requires the media domain
    // (PUBLIC_BASE_URL) to be URL-verified in the TikTok developer app.
    const init = await ttPost(accessToken, "/post/publish/content/init/", {
      post_info: { title: caption, privacy_level: privacy },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: mediaUrls,
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    });
    publishId = init.publish_id;
  }

  const postId = await waitForPublish(accessToken, publishId);
  return {
    url: postId
      ? `https://www.tiktok.com/@${handle}/video/${postId}`
      : `https://www.tiktok.com/@${handle}`,
    externalId: postId ?? publishId,
  };
}
