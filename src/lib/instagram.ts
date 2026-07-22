// Instagram OAuth via the "Instagram API with Instagram Login" (Instagram Business Login).
// This is a single OAuth against instagram.com — no Facebook Page linkage required —
// which mirrors the Google flow already in this codebase. It targets Instagram
// professional (Business/Creator) accounts.
//
// Set up a Meta app (https://developers.facebook.com) with the "Instagram" product,
// then put the Instagram app ID/secret in INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET.
// Add {origin}/api/auth/instagram/callback as a valid OAuth Redirect URI in the app.

// Scopes: basic profile read + content publishing.
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export function instagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET);
}

import { appBaseUrl } from "./base-url";

export { appBaseUrl };

export function redirectUri(origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/instagram/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.INSTAGRAM_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  // Force a fresh login so the user can pick the correct (tester) account,
  // instead of silently reusing whatever IG session is already in the browser.
  url.searchParams.set("force_reauth", "true");
  return url.toString();
}

interface ShortLivedToken {
  access_token: string;
  user_id: number | string;
}

// Step 1: authorization code -> short-lived token (~1 hour) + IG user id.
export async function exchangeCodeForToken(
  origin: string,
  code: string
): Promise<ShortLivedToken> {
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_message || data.error?.message || "Token exchange failed");
  }
  return { access_token: data.access_token, user_id: data.user_id };
}

interface LongLivedToken {
  access_token: string;
  expires_in: number; // seconds (~60 days)
}

// Step 2: short-lived -> long-lived token (~60 days).
export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<LongLivedToken> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", process.env.INSTAGRAM_CLIENT_SECRET!);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Long-lived token exchange failed");
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

interface IgProfile {
  user_id: string;
  username: string;
}

// Step 3: read the connected account's username for display.
export async function fetchProfile(accessToken: string): Promise<IgProfile> {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.username) {
    throw new Error(data.error?.message || "Failed to read Instagram profile");
  }
  return { user_id: String(data.user_id), username: data.username };
}

// ── Content Publishing ─────────────────────────────────────────────────────
// Instagram publishes in two steps: create a *media container* that points at a
// PUBLIC media URL, then publish that container. Instagram's servers fetch the
// URL themselves, so the media must be reachable over public HTTPS (no
// localhost, no self-signed certs) — see PUBLIC_BASE_URL.
const GRAPH = "https://graph.instagram.com/v21.0";

async function igPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Instagram API error (${path})`);
  return data;
}

async function igGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Instagram API error (${path})`);
  return data;
}

// Poll a container until Instagram finishes ingesting the media (videos take time).
async function waitForContainer(accessToken: string, containerId: string) {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const { status_code } = await igGet(containerId, {
      fields: "status_code",
      access_token: accessToken,
    });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram could not process the media (status: ${status_code})`);
    }
    if (Date.now() > deadline) throw new Error("Instagram media processing timed out");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export interface IgPublishInput {
  igUserId: string;
  accessToken: string;
  type: "photos" | "video";
  mediaUrls: string[]; // public https URLs
  caption: string;
  firstComment?: string;
}

// Publishes a photo (single or carousel) or a video (as a Reel) and returns the
// live permalink + media id.
export async function publishToInstagram(
  input: IgPublishInput
): Promise<{ url: string; externalId: string }> {
  const { igUserId, accessToken, type, mediaUrls, caption, firstComment } = input;
  if (mediaUrls.length === 0) throw new Error("No media to publish");

  let containerId: string;

  if (type === "video") {
    // Standalone videos publish as Reels on the current API.
    const c = await igPost(`${igUserId}/media`, {
      media_type: "REELS",
      video_url: mediaUrls[0],
      caption,
      access_token: accessToken,
    });
    containerId = c.id;
  } else if (mediaUrls.length === 1) {
    const c = await igPost(`${igUserId}/media`, {
      image_url: mediaUrls[0],
      caption,
      access_token: accessToken,
    });
    containerId = c.id;
  } else {
    // Carousel: create a child container per image, then a parent CAROUSEL.
    const children: string[] = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const child = await igPost(`${igUserId}/media`, {
        image_url: url,
        is_carousel_item: "true",
        access_token: accessToken,
      });
      children.push(child.id);
    }
    for (const child of children) await waitForContainer(accessToken, child);
    const parent = await igPost(`${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: accessToken,
    });
    containerId = parent.id;
  }

  await waitForContainer(accessToken, containerId);
  const published = await igPost(`${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  });
  const mediaId = String(published.id);

  let permalink = "";
  try {
    const meta = await igGet(mediaId, { fields: "permalink", access_token: accessToken });
    permalink = meta.permalink ?? "";
  } catch {
    /* permalink is best-effort */
  }

  // Instagram convention: hashtags go in the first comment.
  if (firstComment) {
    try {
      await igPost(`${mediaId}/comments`, { message: firstComment, access_token: accessToken });
    } catch {
      /* first comment is best-effort */
    }
  }

  return { url: permalink || `https://www.instagram.com/`, externalId: mediaId };
}
