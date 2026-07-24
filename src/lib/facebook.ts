// Facebook Pages publishing via the Graph API.
//
// The Graph API can only publish to Pages the user manages — never to personal
// profiles. The OAuth flow therefore ends with a Page picker: the callback
// stores the user token + the Page list, and the user chooses which Page to
// connect (its Page access token becomes the account's accessToken).
//
// Set up a Meta app (https://developers.facebook.com) with "Facebook Login",
// put the app ID/secret in FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET and add
// {origin}/api/auth/facebook/callback as a valid OAuth Redirect URI.
// Page tokens derived from a long-lived user token do not expire.

import { appBaseUrl } from "./base-url";
import { TokenExpiredError } from "./oauth-errors";

const GRAPH = "https://graph.facebook.com/v21.0";
// read_insights is what makes Page/post impressions readable; without it the
// analytics sync still records follower and engagement counts.
const SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "read_insights",
];

// Platform extras stored in SocialAccount.meta for Facebook connections.
export interface FacebookMeta {
  userToken: string; // long-lived user token (used to re-derive page tokens)
  pages: { id: string; name: string; access_token: string }[];
}

export function facebookConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/facebook/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  // Re-prompt the permission/Page-selection dialog instead of silently reusing
  // a previous grant — otherwise an empty Page grant can never be corrected.
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

function fbError(data: { error?: { message?: string; code?: number } }, context: string): Error {
  if (data.error?.code === 190) return new TokenExpiredError("Facebook");
  return new Error(data.error?.message || `Facebook API error (${context})`);
}

async function fbGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw fbError(data, path);
  return data;
}

async function fbPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw fbError(data, path);
  return data;
}

// Step 1: authorization code -> short-lived user token.
export async function exchangeCodeForToken(
  origin: string,
  code: string
): Promise<{ access_token: string }> {
  return fbGet("oauth/access_token", {
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
    redirect_uri: redirectUri(origin),
    code,
  });
}

// Step 2: short-lived -> long-lived user token (~60 days).
export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<{ access_token: string }> {
  return fbGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
    fb_exchange_token: shortToken,
  });
}

// Diagnostic: which permissions the user's token actually carries.
export async function fetchPermissions(
  userToken: string
): Promise<{ permission: string; status: string }[]> {
  const data = await fbGet("me/permissions", { access_token: userToken });
  return data.data ?? [];
}

// The Page IDs the user's grant actually covers, read from token introspection
// (granular_scopes.target_ids). Works even when /me/accounts returns nothing.
export async function fetchGrantedPageIds(userToken: string): Promise<string[]> {
  const appToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`;
  const data = await fbGet("debug_token", { input_token: userToken, access_token: appToken });
  const scopes: { scope?: string; target_ids?: string[] }[] = data.data?.granular_scopes ?? [];
  const ids = new Set<string>();
  for (const s of scopes) {
    if (s.scope?.startsWith("pages_")) for (const id of s.target_ids ?? []) ids.add(id);
  }
  return [...ids];
}

// Fallback for accounts where /me/accounts returns [] despite granted
// permissions (a real Meta quirk on newer accounts): fetch one Page directly
// by ID — works whenever the user granted the app access to that Page.
export async function fetchPageDirect(
  userToken: string,
  pageId: string
): Promise<{ id: string; name: string; access_token: string }> {
  const data = await fbGet(pageId, {
    fields: "id,name,access_token",
    access_token: userToken,
  });
  if (!data.access_token) {
    throw new Error("Facebook did not return a Page token — check the Page ID and access");
  }
  return data;
}

// Step 3: list the Pages the user manages, with their Page access tokens.
export async function fetchPages(
  userToken: string
): Promise<{ id: string; name: string; access_token: string }[]> {
  const data = await fbGet("me/accounts", {
    fields: "id,name,access_token",
    access_token: userToken,
  });
  return data.data ?? [];
}

// ── Analytics ──────────────────────────────────────────────────────────────
// Read straight from the Graph API. Metrics the Page token can't reach stay
// undefined rather than being filled with a placeholder.

function dayInsight(
  data: { data?: { name?: string; values?: { value?: number }[] }[] },
  name: string
): number | undefined {
  const entry = data.data?.find((d) => d.name === name);
  const values = entry?.values;
  if (!values?.length) return undefined;
  const total = values.reduce((sum, v) => sum + (v.value ?? 0), 0);
  return Number.isFinite(total) ? total : undefined;
}

export interface FbPageMetrics {
  followers?: number;
  reach?: number;
  impressions?: number;
}

export async function fetchPageMetrics(
  pageId: string,
  pageToken: string
): Promise<FbPageMetrics> {
  const out: FbPageMetrics = {};

  try {
    const page = await fbGet(pageId, {
      fields: "followers_count,fan_count",
      access_token: pageToken,
    });
    const followers = page.followers_count ?? page.fan_count;
    if (typeof followers === "number") out.followers = followers;
  } catch {
    /* leave undefined */
  }

  try {
    const data = await fbGet(`${pageId}/insights`, {
      metric: "page_impressions,page_impressions_unique",
      period: "day",
      access_token: pageToken,
    });
    out.impressions = dayInsight(data, "page_impressions");
    out.reach = dayInsight(data, "page_impressions_unique");
  } catch {
    /* read_insights not granted */
  }

  return out;
}

export interface FbPostMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export async function fetchPostMetrics(
  postId: string,
  pageToken: string
): Promise<FbPostMetrics> {
  const out: FbPostMetrics = {};

  try {
    const post = await fbGet(postId, {
      fields: "likes.summary(true),comments.summary(true),shares",
      access_token: pageToken,
    });
    const likes = post.likes?.summary?.total_count;
    const comments = post.comments?.summary?.total_count;
    const shares = post.shares?.count;
    if (typeof likes === "number") out.likes = likes;
    if (typeof comments === "number") out.comments = comments;
    if (typeof shares === "number") out.shares = shares;
  } catch {
    /* post deleted or not readable */
  }

  try {
    const data = await fbGet(`${postId}/insights`, {
      metric: "post_impressions",
      access_token: pageToken,
    });
    out.views = dayInsight(data, "post_impressions");
  } catch {
    /* read_insights not granted */
  }

  return out;
}

export interface FbPublishInput {
  pageId: string;
  pageToken: string;
  type: "video" | "photos" | "text";
  mediaUrls: string[]; // public https URLs (Graph fetches them itself)
  message: string;
  firstComment?: string;
}

// Publishes a text post, photo (single or multi) or video to a Page and
// returns the live post URL + id.
export async function publishToFacebook(
  input: FbPublishInput
): Promise<{ url: string; externalId: string }> {
  const { pageId, pageToken, type, mediaUrls, message, firstComment } = input;

  let postId: string;
  if (type === "text") {
    const data = await fbPost(`${pageId}/feed`, { message, access_token: pageToken });
    postId = data.id;
  } else if (type === "photos" && mediaUrls.length === 1) {
    const data = await fbPost(`${pageId}/photos`, {
      url: mediaUrls[0],
      caption: message,
      access_token: pageToken,
    });
    postId = data.post_id ?? data.id;
  } else if (type === "photos") {
    // Multi-photo: upload each unpublished, then attach them all to one post.
    const mediaIds: string[] = [];
    for (const url of mediaUrls) {
      const photo = await fbPost(`${pageId}/photos`, {
        url,
        published: "false",
        access_token: pageToken,
      });
      mediaIds.push(photo.id);
    }
    const params: Record<string, string> = { message, access_token: pageToken };
    mediaIds.forEach((id, i) => {
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });
    const data = await fbPost(`${pageId}/feed`, params);
    postId = data.id;
  } else {
    // Video: Graph pulls the file from a public URL (like Instagram).
    const data = await fbPost(`${pageId}/videos`, {
      file_url: mediaUrls[0],
      description: message,
      access_token: pageToken,
    });
    postId = data.id;
  }

  if (firstComment) {
    try {
      await fbPost(`${postId}/comments`, { message: firstComment, access_token: pageToken });
    } catch {
      /* first comment is best-effort */
    }
  }

  return { url: `https://www.facebook.com/${postId}`, externalId: postId };
}
