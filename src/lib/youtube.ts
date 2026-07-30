// YouTube publishing via the Data API v3 (resumable upload), authorized with
// Google OAuth. Reuses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as Google
// login — in the Google Cloud project: enable "YouTube Data API v3", add the
// youtube.upload + youtube.readonly scopes to the OAuth consent screen, and add
// {origin}/api/auth/youtube/callback as an authorized redirect URI.
//
// Google access tokens last ~1h; access_type=offline + prompt=consent yields a
// refresh token, and ensureFreshToken() refreshes it before each publish.
// NOTE: until the Google app passes YouTube API compliance review, videos
// uploaded via the API are locked to PRIVATE regardless of privacyStatus — this
// is Google's policy, not a bug here.

import { appBaseUrl } from "./base-url";
import { StoredFile, readStoredFile } from "./upload";
import { TokenExpiredError } from "./oauth-errors";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export function youtubeConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/youtube/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline"); // ask for a refresh token
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent"); // force consent so a refresh token is returned
  return url.toString();
}

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string; // only on first consent (prompt=consent forces it)
}

async function tokenRequest(params: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }
  return data;
}

export async function exchangeCodeForToken(origin: string, code: string): Promise<GoogleTokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
}

// Google refresh does NOT return a new refresh_token — the original stays valid.
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// The authorized user's YouTube channel (id + title).
export async function fetchChannel(accessToken: string): Promise<{ id: string; title: string }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new TokenExpiredError("YouTube");
  const data = await res.json();
  const channel = data.items?.[0];
  if (!res.ok || !channel) {
    throw new Error(data.error?.message || "No YouTube channel found for this Google account");
  }
  return { id: channel.id, title: channel.snippet?.title ?? "YouTube" };
}

export interface YouTubePublishInput {
  accessToken: string;
  video: StoredFile;
  title: string;
  description: string;
}

// Uploads a video via the resumable protocol and returns the watch URL + id.
export async function publishToYouTube(
  input: YouTubePublishInput
): Promise<{ url: string; externalId: string }> {
  const bytes = await readStoredFile(input.video);
  const mime = input.video.mime && input.video.mime !== "url" ? input.video.mime : "video/*";
  const metadata = {
    snippet: {
      title: input.title.slice(0, 100) || "Untitled",
      description: input.description.slice(0, 5000),
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY ?? "public",
      selfDeclaredMadeForKids: false,
    },
  };

  // 1) Start a resumable upload session — returns the session URL in Location.
  const startRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(bytes.length),
        "x-upload-content-type": mime,
      },
      body: JSON.stringify(metadata),
    }
  );
  if (startRes.status === 401) throw new TokenExpiredError("YouTube");
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `YouTube upload init failed (${startRes.status})`);
  }
  const sessionUrl = startRes.headers.get("location");
  if (!sessionUrl) throw new Error("YouTube did not return a resumable upload URL");

  // 2) Upload the bytes to the session URL.
  const uploadRes = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "content-type": mime },
    body: new Uint8Array(bytes),
  });
  const data = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !data.id) {
    throw new Error(data.error?.message || `YouTube upload failed (${uploadRes.status})`);
  }
  return { url: `https://www.youtube.com/watch?v=${data.id}`, externalId: data.id };
}
