// Mastodon publishing via an instance access token — no OAuth round trip.
// The user creates an application at {instance}/settings/applications with
// write:statuses + write:media scopes and pastes the access token it issues.
//
// The instance host is user-supplied, so every request goes through safeFetch.
//
// Unlike most platforms here, Mastodon's limits are PER INSTANCE — 500
// characters is only mastodon.social's default. The real numbers are read from
// /api/v2/instance at connect time and cached in the account's meta.

import { StoredFile, readStoredFile } from "./upload";
import { PostType } from "./platforms";
import { safeFetch, BlockedUrlError } from "./safe-fetch";
import { normalizeExternalBaseUrl } from "./base-url";

export const normalizeInstanceUrl = (raw: string) =>
  normalizeExternalBaseUrl(raw, "Mastodon instance URL");

export interface MastodonLimits {
  maxCharacters: number;
  maxMedia: number;
  imageSizeLimit: number;
  videoSizeLimit: number;
}

// Conservative fallbacks, used only when an instance doesn't report its own.
const DEFAULT_LIMITS: MastodonLimits = {
  maxCharacters: 500,
  maxMedia: 4,
  imageSizeLimit: 10 * 1024 * 1024,
  videoSizeLimit: 40 * 1024 * 1024,
};

async function mastoFetch(
  instance: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await safeFetch(`${instance}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      throw new Error(`Can't reach that Mastodon instance — ${err.message}`);
    }
    throw err;
  }
}

export async function fetchInstanceLimits(instance: string): Promise<MastodonLimits> {
  try {
    const res = await safeFetch(`${instance}/api/v2/instance`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return DEFAULT_LIMITS;
    const d = await res.json();
    const statuses = d.configuration?.statuses ?? {};
    const media = d.configuration?.media_attachments ?? {};
    return {
      maxCharacters: Number(statuses.max_characters) || DEFAULT_LIMITS.maxCharacters,
      maxMedia: Number(statuses.max_media_attachments) || DEFAULT_LIMITS.maxMedia,
      imageSizeLimit: Number(media.image_size_limit) || DEFAULT_LIMITS.imageSizeLimit,
      videoSizeLimit: Number(media.video_size_limit) || DEFAULT_LIMITS.videoSizeLimit,
    };
  } catch {
    // An instance that won't describe itself still publishes fine.
    return DEFAULT_LIMITS;
  }
}

// Validate by reading the token's own account. Publishes nothing.
export async function validateMastodon(
  rawInstance: string,
  rawToken: string
): Promise<{ instance: string; userId: string; acct: string; limits: MastodonLimits }> {
  const instance = normalizeInstanceUrl(rawInstance);
  const token = rawToken.trim();
  if (!token) throw new Error("Enter your Mastodon access token");

  const res = await mastoFetch(instance, token, "/api/v1/accounts/verify_credentials");
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Mastodon rejected that token. Create one at ${instance}/settings/applications with the write:statuses and write:media scopes.`
    );
  }
  if (res.status === 404) {
    throw new Error(`No Mastodon API found at ${instance} — check the instance URL.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.error || `Mastodon rejected the request (${res.status})`);
  }
  return {
    instance,
    userId: String(data.id),
    acct: String(data.acct ?? data.username ?? "mastodon"),
    limits: await fetchInstanceLimits(instance),
  };
}

// ── Media ────────────────────────────────────────────────────────────────────
// v2/media returns 202 while the instance is still processing; the attachment
// can't be used in a status until it reports ready.
const MEDIA_TIMEOUT_MS = 120_000;

async function waitForMedia(instance: string, token: string, id: string): Promise<void> {
  const deadline = Date.now() + MEDIA_TIMEOUT_MS;
  for (;;) {
    const res = await mastoFetch(instance, token, `/api/v1/media/${id}`);
    if (res.status === 200) return;
    if (res.status !== 206 && res.status !== 202) {
      throw new Error(`Mastodon could not process the attachment (${res.status})`);
    }
    if (Date.now() > deadline) throw new Error("Mastodon media processing timed out");
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function uploadMedia(
  instance: string,
  token: string,
  file: StoredFile,
  limits: MastodonLimits
): Promise<string> {
  const buf = await readStoredFile(file);
  const isVideo = file.mime.startsWith("video/");
  const cap = isVideo ? limits.videoSizeLimit : limits.imageSizeLimit;
  if (buf.byteLength > cap) {
    throw new Error(
      `"${file.name}" is ${(buf.byteLength / 1048576).toFixed(1)}MB — this instance allows ${(cap / 1048576).toFixed(0)}MB`
    );
  }

  const form = new FormData();
  const mime = file.mime === "url" ? "application/octet-stream" : file.mime;
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), file.name || "upload");

  const res = await mastoFetch(instance, token, "/api/v2/media", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(data.error || `Mastodon rejected "${file.name}" (${res.status})`);
  }
  if (!data.id) throw new Error(`Mastodon returned no attachment id for "${file.name}"`);

  // 202 means "accepted, still transcoding".
  if (res.status === 202) await waitForMedia(instance, token, String(data.id));
  return String(data.id);
}

// ── Publishing ───────────────────────────────────────────────────────────────

export interface MastodonPublishInput {
  instance: string;
  token: string;
  type: PostType;
  media: StoredFile[];
  text: string;
  limits?: MastodonLimits;
}

export async function publishToMastodon(
  input: MastodonPublishInput
): Promise<{ url: string; externalId: string }> {
  const instance = normalizeInstanceUrl(input.instance);
  const { token, type, media, text } = input;
  const limits = input.limits ?? DEFAULT_LIMITS;

  const mediaIds: string[] = [];
  if (type !== "text") {
    if (media.length > limits.maxMedia) {
      throw new Error(
        `This Mastodon instance allows at most ${limits.maxMedia} attachments per post (got ${media.length})`
      );
    }
    for (const file of media) mediaIds.push(await uploadMedia(instance, token, file, limits));
  }

  const res = await mastoFetch(instance, token, "/api/v1/statuses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Guards against a retried publish creating a duplicate toot.
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ status: text, ...(mediaIds.length ? { media_ids: mediaIds } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.error || `Mastodon rejected the post (${res.status})`);
  }
  return { url: String(data.url ?? ""), externalId: String(data.id) };
}
