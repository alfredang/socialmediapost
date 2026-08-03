// WordPress publishing via the built-in REST API and an Application Password
// (Users → Profile → Application Passwords). Works on self-hosted WordPress 5.6+
// and WordPress.com sites with the REST API enabled. No OAuth, no plugin.
//
// The site URL is supplied by the user, so every request here goes through
// safeFetch — a naive fetch would let someone point a "site" at 169.254.169.254
// or a service on localhost and have the server dutifully call it.

import { StoredFile, readStoredFile } from "./upload";
import { PostType } from "./platforms";
import { fetchUserHost } from "./safe-fetch";
import { normalizeExternalBaseUrl } from "./base-url";

export const normalizeSiteUrl = (raw: string) =>
  normalizeExternalBaseUrl(raw, "WordPress site URL");

// WordPress displays application passwords in space-separated groups of four.
// The spaces are presentational and must be stripped before authenticating.
function authHeader(username: string, appPassword: string): string {
  const secret = appPassword.replace(/\s+/g, "");
  return `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`;
}

async function wpFetch(
  site: string,
  auth: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // NOTE: safeFetch preserves headers across redirects, so a site that
  // redirects cross-host would forward this Basic credential. That's the user's
  // own site config; the SSRF guard is the part that matters here.
  return fetchUserHost(
    `${site}/wp-json/wp/v2${path}`,
    { ...init, headers: { ...(init.headers ?? {}), authorization: auth } },
    "WordPress site"
  );
}

export async function validateWordPress(
  rawSite: string,
  username: string,
  appPassword: string
): Promise<{ site: string; userId: string; displayName: string }> {
  const site = normalizeSiteUrl(rawSite);
  if (!username.trim()) throw new Error("Enter your WordPress username");
  if (!appPassword.trim()) throw new Error("Enter your WordPress application password");

  const auth = authHeader(username.trim(), appPassword);
  const res = await wpFetch(site, auth, "/users/me?context=edit");

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "WordPress rejected those credentials. Use an Application Password (Users → Profile → Application Passwords), not your login password."
    );
  }
  if (res.status === 404) {
    throw new Error(
      `No REST API found at ${site}/wp-json — check the URL, and that the REST API isn't disabled by a plugin.`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.message || `WordPress rejected the request (${res.status})`);
  }
  return { site, userId: String(data.id), displayName: data.name || username };
}

// ── Content ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The composer produces plain text; WordPress post content is HTML. Escape it
// (never trust it as markup), then map blank lines to paragraphs.
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

interface UploadedMedia {
  id: number;
  sourceUrl: string;
  isImage: boolean;
}

async function uploadMedia(
  site: string,
  auth: string,
  file: StoredFile
): Promise<UploadedMedia> {
  const buf = await readStoredFile(file);
  const filename = (file.name || file.path || "upload").replace(/[^\w.-]/g, "_");
  const mime = file.mime !== "url" && file.mime ? file.mime : "application/octet-stream";

  const res = await wpFetch(site, auth, "/media", {
    method: "POST",
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${filename}"`,
    },
    body: new Uint8Array(buf),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.message || `WordPress rejected "${file.name}" (${res.status})`);
  }
  return {
    id: Number(data.id),
    sourceUrl: String(data.source_url ?? ""),
    isImage: mime.startsWith("image/"),
  };
}

export interface WordPressPublishInput {
  site: string;
  username: string;
  appPassword: string;
  type: PostType;
  media: StoredFile[];
  title: string;
  body: string;
}

export async function publishToWordPress(
  input: WordPressPublishInput
): Promise<{ url: string; externalId: string }> {
  const { username, appPassword, type, media, title, body } = input;
  const site = normalizeSiteUrl(input.site);
  const auth = authHeader(username, appPassword);

  if (!title.trim()) throw new Error("WordPress posts need a title");

  const uploaded: UploadedMedia[] = [];
  if (type !== "text") {
    for (const file of media) uploaded.push(await uploadMedia(site, auth, file));
  }

  const embeds = uploaded
    .map((m) =>
      m.isImage
        ? `<figure class="wp-block-image"><img src="${escapeHtml(m.sourceUrl)}" alt="" /></figure>`
        : `<figure class="wp-block-video"><video controls src="${escapeHtml(m.sourceUrl)}"></video></figure>`
    )
    .join("\n");

  const content = [textToHtml(body), embeds].filter(Boolean).join("\n");
  // Featured image only makes sense for an actual image.
  const featured = uploaded.find((m) => m.isImage)?.id;

  const res = await wpFetch(site, auth, "/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      content,
      status: "publish",
      ...(featured ? { featured_media: featured } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.message || `WordPress rejected the post (${res.status})`);
  }
  return { url: String(data.link ?? ""), externalId: String(data.id) };
}
