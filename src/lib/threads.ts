// Threads publishing via the Threads API (graph.threads.net). A single OAuth
// flow against threads.net — no Facebook Page linkage. Publishing mirrors
// Instagram: create a media container pointing at a PUBLIC media URL, then
// publish it — so media must be reachable over public HTTPS (PUBLIC_BASE_URL).
//
// Create an app with the "Threads API" use case at https://developers.facebook.com,
// put the Threads app ID/secret in THREADS_CLIENT_ID / THREADS_CLIENT_SECRET, and
// add {origin}/api/auth/threads/callback as a redirect callback URL.
// Long-lived tokens last ~60 days; ensureFreshToken() refreshes before expiry.

import { appBaseUrl } from "./base-url";
import { TokenExpiredError } from "./oauth-errors";

const GRAPH = "https://graph.threads.net";
const SCOPES = ["threads_basic", "threads_content_publish"];

export function threadsConfigured(): boolean {
  return Boolean(process.env.THREADS_CLIENT_ID && process.env.THREADS_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/threads/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", process.env.THREADS_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

// Auth code → short-lived token (+ the Threads user id).
export async function exchangeCodeForToken(
  origin: string,
  code: string
): Promise<{ access_token: string; user_id: string }> {
  const res = await fetch(`${GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.THREADS_CLIENT_ID!,
      client_secret: process.env.THREADS_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || data.error_message || "Threads token exchange failed");
  }
  return { access_token: data.access_token, user_id: String(data.user_id) };
}

// Short-lived → long-lived (~60 days).
export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", process.env.THREADS_CLIENT_SECRET!);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error?.message || "Threads long-lived exchange failed");
  return { access_token: data.access_token, expires_in: data.expires_in ?? 5184000 };
}

// Threads refreshes the long-lived token itself (no separate refresh token).
export async function refreshAccessToken(
  longToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", longToken);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error?.message || "Threads token refresh failed");
  return { access_token: data.access_token, expires_in: data.expires_in ?? 5184000 };
}

export async function fetchProfile(
  accessToken: string,
  userId: string
): Promise<{ id: string; username: string }> {
  const url = new URL(`${GRAPH}/v1.0/${userId}`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (res.status === 401) throw new TokenExpiredError("Threads");
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || "Failed to read Threads profile");
  return { id: String(data.id), username: data.username ?? "threads" };
}

// ── Publishing ───────────────────────────────────────────────────────────────
async function thPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/v1.0/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (res.status === 401) throw new TokenExpiredError("Threads");
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || `Threads API error (${path})`);
  return data;
}

async function thGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/v1.0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (res.status === 401) throw new TokenExpiredError("Threads");
  return res.json();
}

// Video containers need a moment to process before they can be published.
async function waitForContainer(accessToken: string, containerId: string) {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const data = await thGet(containerId, { fields: "status", access_token: accessToken });
    if (data.status === "FINISHED") return;
    if (data.status === "ERROR" || data.status === "EXPIRED") {
      throw new Error(`Threads could not process the media (status: ${data.status})`);
    }
    if (Date.now() > deadline) throw new Error("Threads media processing timed out");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export interface ThreadsPublishInput {
  userId: string;
  accessToken: string;
  type: "video" | "photos" | "text";
  mediaUrls: string[]; // public https URLs
  text: string;
}

export async function publishToThreads(
  input: ThreadsPublishInput
): Promise<{ url: string; externalId: string }> {
  const { userId, accessToken, type, mediaUrls, text } = input;

  let creationId: string;
  if (type === "text" || mediaUrls.length === 0) {
    const c = await thPost(`${userId}/threads`, { media_type: "TEXT", text, access_token: accessToken });
    creationId = c.id;
  } else if (type === "video") {
    const c = await thPost(`${userId}/threads`, {
      media_type: "VIDEO",
      video_url: mediaUrls[0],
      text,
      access_token: accessToken,
    });
    await waitForContainer(accessToken, c.id);
    creationId = c.id;
  } else if (mediaUrls.length === 1) {
    const c = await thPost(`${userId}/threads`, {
      media_type: "IMAGE",
      image_url: mediaUrls[0],
      text,
      access_token: accessToken,
    });
    creationId = c.id;
  } else {
    // Carousel: item containers, then a CAROUSEL parent.
    const children: string[] = [];
    for (const url of mediaUrls.slice(0, 20)) {
      const item = await thPost(`${userId}/threads`, {
        media_type: "IMAGE",
        image_url: url,
        is_carousel_item: "true",
        access_token: accessToken,
      });
      children.push(item.id);
    }
    const parent = await thPost(`${userId}/threads`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      text,
      access_token: accessToken,
    });
    creationId = parent.id;
  }

  const published = await thPost(`${userId}/threads_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  const mediaId = String(published.id);

  let permalink = "";
  try {
    const meta = await thGet(mediaId, { fields: "permalink", access_token: accessToken });
    permalink = meta.permalink ?? "";
  } catch {
    /* permalink is best-effort */
  }

  return { url: permalink || "https://www.threads.net/", externalId: mediaId };
}
