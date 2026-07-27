// LinkedIn member publishing via the versioned REST Posts API.
//
// v1 posts as the authenticated member (organization pages need extra Marketing
// Developer Platform approval). Media is PUSHED to LinkedIn: initializeUpload
// -> PUT bytes -> reference the returned URN from the post, so no public media
// URL is needed. Access tokens last ~60 days; programmatic refresh is
// partner-gated, so on expiry the account flips to needs_reauth instead.
//
// Create an app at https://developer.linkedin.com with the "Share on LinkedIn"
// and "Sign In with LinkedIn using OpenID Connect" products, put the client
// ID/secret in LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET and add
// {origin}/api/auth/linkedin/callback as an authorized redirect URL.

import { appBaseUrl } from "./base-url";
import { StoredFile, readStoredFile } from "./upload";
import { TokenExpiredError } from "./oauth-errors";

const SCOPES = ["openid", "profile", "w_member_social"];
const REST = "https://api.linkedin.com/rest";
// LinkedIn-Version header (YYYYMM), pinned. LinkedIn publishes monthly and keeps
// each version active for a MINIMUM OF ONE YEAR, then sunsets it — a stale pin
// fails with "Requested version <YYYYMM01> is not active". Bump this to a current
// version at least annually; see https://learn.microsoft.com/linkedin/marketing/versioning
const LI_VERSION = "202607";

export function linkedinConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/linkedin/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

// Authorization code -> access token (~60 days). refresh_token only appears
// for partner-approved apps.
export async function exchangeCodeForToken(
  origin: string,
  code: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(origin),
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "LinkedIn token exchange failed");
  }
  return data;
}

// OpenID Connect userinfo — member id (sub) + display name.
export async function fetchProfile(
  accessToken: string
): Promise<{ sub: string; name: string }> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok || !data.sub) {
    throw new Error(data.message || "Failed to read LinkedIn profile");
  }
  return { sub: data.sub, name: data.name ?? data.sub };
}

function liHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function liFetch(accessToken: string, path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${REST}${path}`, {
    method: "POST",
    headers: liHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new TokenExpiredError("LinkedIn");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `LinkedIn API error (${path}, ${res.status})`);
  }
  return res;
}

// LinkedIn's "little text format" treats these as control characters in
// commentary; unescaped parentheses/brackets cause 400s on real posts.
function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

// initializeUpload -> PUT bytes -> URN, shared by images and documents.
async function uploadAsset(
  kind: "images" | "documents",
  accessToken: string,
  owner: string,
  file: StoredFile
): Promise<string> {
  const res = await liFetch(accessToken, `/${kind}?action=initializeUpload`, {
    initializeUploadRequest: { owner },
  });
  const { value } = await res.json();
  const bytes = await readStoredFile(file);
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}` },
    body: new Uint8Array(bytes),
  });
  if (!put.ok) throw new Error(`LinkedIn ${kind} upload failed (${put.status})`);
  return kind === "images" ? value.image : value.document;
}

// Videos upload in parts and process asynchronously; poll until AVAILABLE.
async function uploadVideo(accessToken: string, owner: string, file: StoredFile): Promise<string> {
  const bytes = await readStoredFile(file);
  const res = await liFetch(accessToken, "/videos?action=initializeUpload", {
    initializeUploadRequest: {
      owner,
      fileSizeBytes: bytes.length,
      uploadCaptions: false,
      uploadThumbnail: false,
    },
  });
  const { value } = await res.json();

  const etags: string[] = [];
  for (const part of value.uploadInstructions as { uploadUrl: string; firstByte: number; lastByte: number }[]) {
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/octet-stream" },
      body: new Uint8Array(bytes.subarray(part.firstByte, part.lastByte + 1)),
    });
    if (!put.ok) throw new Error(`LinkedIn video upload failed (${put.status})`);
    etags.push(put.headers.get("etag") ?? "");
  }

  await liFetch(accessToken, "/videos?action=finalizeUpload", {
    finalizeUploadRequest: {
      video: value.video,
      uploadToken: value.uploadToken ?? "",
      uploadedPartIds: etags,
    },
  });

  // Wait for processing so the post creation doesn't reject the URN.
  const deadline = Date.now() + 90_000;
  for (;;) {
    const check = await fetch(`${REST}/videos/${encodeURIComponent(value.video)}`, {
      headers: liHeaders(accessToken),
    });
    const data = await check.json().catch(() => ({}));
    if (data.status === "AVAILABLE") return value.video;
    if (data.status === "PROCESSING_FAILED") throw new Error("LinkedIn could not process the video");
    if (Date.now() > deadline) throw new Error("LinkedIn video processing timed out");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// ── Analytics ──────────────────────────────────────────────────────────────
// LinkedIn exposes per-post social actions to the author, but member follower
// counts and impressions are organization/partner-gated — the sync therefore
// reports likes and comments only, and records nothing it cannot read.

export interface LiPostMetrics {
  likes?: number;
  comments?: number;
}

export async function fetchPostMetrics(
  accessToken: string,
  postUrn: string
): Promise<LiPostMetrics> {
  const res = await fetch(`${REST}/socialActions/${encodeURIComponent(postUrn)}`, {
    headers: liHeaders(accessToken),
  });
  if (res.status === 401) throw new TokenExpiredError("LinkedIn");
  if (!res.ok) return {};

  const data = await res.json().catch(() => ({}));
  const out: LiPostMetrics = {};
  const likes = data.likesSummary?.totalLikes;
  const comments = data.commentsSummary?.totalFirstLevelComments ?? data.commentsSummary?.aggregatedTotalComments;
  if (typeof likes === "number") out.likes = likes;
  if (typeof comments === "number") out.comments = comments;
  return out;
}

export interface LiPublishInput {
  personId: string; // OpenID sub
  accessToken: string;
  type: "video" | "photos" | "text" | "document";
  media: StoredFile[];
  commentary: string;
  title?: string; // media title for video/document cards
  firstComment?: string;
}

// Publishes a member post (text, images, video or document) and returns the
// live feed URL + post URN.
export async function publishToLinkedIn(
  input: LiPublishInput
): Promise<{ url: string; externalId: string }> {
  const { personId, accessToken, type, media, commentary, title, firstComment } = input;
  const author = `urn:li:person:${personId}`;

  let content: Record<string, unknown> | undefined;
  if (type === "photos") {
    if (media.length === 0) throw new Error("No media to publish");
    const urns: string[] = [];
    for (const file of media) urns.push(await uploadAsset("images", accessToken, author, file));
    content =
      urns.length === 1
        ? { media: { id: urns[0] } }
        : { multiImage: { images: urns.map((id) => ({ id })) } };
  } else if (type === "video") {
    const urn = await uploadVideo(accessToken, author, media[0]);
    content = { media: { id: urn, title: title || media[0].name } };
  } else if (type === "document") {
    const urn = await uploadAsset("documents", accessToken, author, media[0]);
    content = { media: { id: urn, title: title || media[0].name } };
  }

  const res = await liFetch(accessToken, "/posts", {
    author,
    commentary: escapeCommentary(commentary),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(content ? { content } : {}),
  });
  // The created post's URN arrives in the x-restli-id header, not the body.
  const postUrn = res.headers.get("x-restli-id");
  if (!postUrn) throw new Error("LinkedIn did not return a post id");

  if (firstComment) {
    try {
      await liFetch(accessToken, `/socialActions/${encodeURIComponent(postUrn)}/comments`, {
        actor: author,
        message: { text: firstComment },
      });
    } catch {
      /* first comment is best-effort */
    }
  }

  return { url: `https://www.linkedin.com/feed/update/${postUrn}/`, externalId: postUrn };
}
