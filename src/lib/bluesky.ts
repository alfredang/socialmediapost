// Bluesky publishing over the AT Protocol XRPC API — no OAuth app registration.
// The credential is the account handle plus an **app password**, which the user
// creates (and can revoke) at Settings → Privacy and security → App passwords.
//
// Sessions are cheap and short-lived, so nothing session-shaped is persisted:
// `accessToken` holds the app password and every publish mints a fresh session.
// That keeps this out of token-refresh.ts entirely — a revoked app password
// fails loudly at createSession and flips the account to needs_reauth.
//
// Media uploads as raw bytes (com.atproto.repo.uploadBlob), so unlike Instagram
// and Threads this needs no PUBLIC_BASE_URL.

import { StoredFile, readStoredFile, uploadPath } from "./upload";
import { PostType } from "./platforms";
import { TokenExpiredError } from "./oauth-errors";
import { probeVideo } from "./ffmpeg";

const SERVICE = "https://bsky.social";

// Video does NOT go through the PDS. It uploads to a separate service that
// transcodes it, and only the resulting blob ref goes into the post record.
const VIDEO_SERVICE = "https://video.bsky.app";

// App passwords are issued as four dash-separated groups. Requiring the shape
// stops a user from pasting their real account password into our database.
const APP_PASSWORD_RE = /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/i;

// bsky.social's PDS rejects image blobs over 1,000,000 bytes outright.
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGES = 4;

// Video service limits. The size cap is deliberately the generous end of what's
// documented — over-blocking a valid upload is worse than letting the service
// return its own clear rejection.
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 180;
// Transcoding a 3-minute video is not fast, and publish blocks on it.
const VIDEO_JOB_TIMEOUT_MS = 300_000;
const VIDEO_POLL_MS = 2_000;

interface Session {
  did: string;
  handle: string;
  accessJwt: string;
  // The DID document, when createSession inlined it. Only the video path needs
  // the PDS host, so it is NOT resolved here: connecting an account and posting
  // text or photos must not depend on the PLC directory being reachable.
  didDoc: unknown;
}

// The account's REAL PDS host. bsky.social is only an entryway that proxies to
// it — fine for ordinary XRPC calls, but service-auth tokens must name the
// actual PDS or the video service rejects them with a 401. Resolved on demand.
async function pdsHostFor(session: Session): Promise<string> {
  return pdsHostFromDidDoc(session.didDoc) ?? (await resolvePdsHost(session.did));
}

// Pulls the PDS service endpoint out of a DID document.
function pdsHostFromDidDoc(didDoc: unknown): string | null {
  const services = (didDoc as { service?: { id?: string; type?: string; serviceEndpoint?: string }[] })
    ?.service;
  const pds = services?.find(
    (s) => s.type === "AtprotoPersonalDataServer" || s.id === "#atproto_pds"
  );
  if (!pds?.serviceEndpoint) return null;
  try {
    return new URL(pds.serviceEndpoint).host;
  } catch {
    return null;
  }
}

// Fallback when createSession didn't inline the DID document.
async function resolvePdsHost(did: string): Promise<string> {
  const url = did.startsWith("did:web:")
    ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
    : `https://plc.directory/${did}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not resolve the PDS for ${did} (${res.status})`);
  const host = pdsHostFromDidDoc(await res.json().catch(() => null));
  if (!host) throw new Error(`No PDS endpoint listed for ${did}`);
  return host;
}

async function xrpc(
  method: string,
  init: RequestInit & { jwt?: string }
): Promise<Record<string, unknown>> {
  const { jwt, ...rest } = init;
  const res = await fetch(`${SERVICE}/xrpc/${method}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.message === "string" ? data.message : `${res.status}`;
    throw new Error(`Bluesky rejected the request — ${message}`);
  }
  return data;
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

async function createSession(handle: string, appPassword: string): Promise<Session> {
  const res = await fetch(`${SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Wrong handle/password, or the app password was revoked.
    throw new TokenExpiredError("Bluesky");
  }
  if (!res.ok || !data.accessJwt) {
    throw new Error(data.message || `Bluesky sign-in failed (${res.status})`);
  }
  return {
    did: String(data.did),
    handle: String(data.handle),
    accessJwt: String(data.accessJwt),
    // Kept as-is; pdsHostFor() reads it only when a video actually needs it.
    didDoc: data.didDoc,
  };
}

// Validate at connect time by signing in — the only way to prove an app
// password works. Creating a session posts nothing.
export async function validateBluesky(
  rawHandle: string,
  appPassword: string
): Promise<{ did: string; handle: string }> {
  const handle = normalizeHandle(rawHandle);
  if (!handle.includes(".")) {
    throw new Error("Enter your full Bluesky handle, including the domain (e.g. you.bsky.social)");
  }
  if (!APP_PASSWORD_RE.test(appPassword.trim())) {
    throw new Error(
      "That isn't an app password. In the Bluesky app: Settings → Privacy and security → App passwords → Add App Password, then paste the xxxx-xxxx-xxxx-xxxx value (never your real password)."
    );
  }
  const session = await createSession(handle, appPassword.trim());
  return { did: session.did, handle: session.handle };
}

// ── Rich text facets ─────────────────────────────────────────────────────────
// Bluesky stores no markup: links and hashtags are plain text unless the record
// carries byte-range facets pointing at them. Without this a posted URL is dead
// text. Offsets are UTF-8 byte indices, not JS string indices.

interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Record<string, string>[];
}

const encoder = new TextEncoder();
const byteLen = (s: string) => encoder.encode(s).length;

function detectFacets(text: string): Facet[] {
  const facets: Facet[] = [];

  // Links. Trailing punctuation is excluded so "see https://x.com." doesn't
  // swallow the sentence's full stop into the URL.
  const linkRe = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;
  for (const m of text.matchAll(linkRe)) {
    const start = byteLen(text.slice(0, m.index));
    facets.push({
      index: { byteStart: start, byteEnd: start + byteLen(m[0]) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }

  // Hashtags — the tag feature carries the text without the leading '#'.
  const tagRe = /(^|\s)(#[\p{L}\p{N}_]+)/gu;
  for (const m of text.matchAll(tagRe)) {
    const tagStart = m.index + m[1].length;
    const start = byteLen(text.slice(0, tagStart));
    facets.push({
      index: { byteStart: start, byteEnd: start + byteLen(m[2]) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2].slice(1) }],
    });
  }

  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

// ── Media ────────────────────────────────────────────────────────────────────

// Media-URL stubs carry mime "url", so the real type has to come from the
// bytes. uploadBlob stores whatever Content-Type it's given, and a wrong one
// makes the image un-renderable in every client.
function sniffImageMime(buf: Buffer): string {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return "image/png";
  if (buf.length > 6 && buf.subarray(0, 3).toString("latin1") === "GIF") return "image/gif";
  if (buf.length > 12 && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  throw new Error("Bluesky only accepts JPEG, PNG, GIF or WebP images");
}

async function uploadBlob(session: Session, file: StoredFile): Promise<unknown> {
  const buf = await readStoredFile(file);
  const mime = file.mime.startsWith("image/") ? file.mime : sniffImageMime(buf);
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `"${file.name}" is ${(buf.byteLength / 1_000_000).toFixed(2)}MB — over Bluesky's 1MB image limit. Compress it and try again.`
    );
  }
  const data = await xrpc("com.atproto.repo.uploadBlob", {
    method: "POST",
    headers: { "content-type": mime },
    body: new Uint8Array(buf),
    jwt: session.accessJwt,
  });
  if (!data.blob) throw new Error(`Bluesky did not accept "${file.name}"`);
  return data.blob;
}

// ── Video ────────────────────────────────────────────────────────────────────
// Three-step flow: mint a service-auth token scoped to one method, push the
// bytes to video.bsky.app, then poll until transcoding yields a blob ref.

// A short-lived token addressed to one service and pinned to one method, so
// each step needs its own. The two audiences are NOT the same and getting them
// backwards is a 401 from the video service:
//   getUploadLimits → did:web:video.bsky.app  (the video service answers it)
//   uploadVideo     → did:web:<user's PDS>    (the video service turns around
//                     and calls uploadBlob on the PDS with this token, which is
//                     also why its lxm is com.atproto.repo.uploadBlob)
async function getServiceAuth(accessJwt: string, aud: string, lxm: string): Promise<string> {
  const url = new URL(`${SERVICE}/xrpc/com.atproto.server.getServiceAuth`);
  url.searchParams.set("aud", aud);
  url.searchParams.set("lxm", lxm);
  url.searchParams.set("exp", String(Math.floor(Date.now() / 1000) + 30 * 60));
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessJwt}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const detail = [data.error, data.message].filter(Boolean).join(": ");
    throw new Error(
      `Bluesky would not issue a service token for ${lxm} (${res.status})${detail ? ` — ${detail}` : ""}`
    );
  }
  return String(data.token);
}

// Pre-flight. Turns the two most common silent failures — unverified email and
// the per-account daily video ceiling — into an error the user can act on,
// before we spend a 100MB upload finding out.
async function assertCanUploadVideo(accessJwt: string): Promise<void> {
  const token = await getServiceAuth(
    accessJwt,
    "did:web:video.bsky.app",
    "app.bsky.video.getUploadLimits"
  );
  const res = await fetch(`${VIDEO_SERVICE}/xrpc/app.bsky.video.getUploadLimits`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  // This endpoint answers with 401 when it is REFUSING you (e.g. an unconfirmed
  // account email), and the reason is in the body. Read the body before judging
  // the status, or the actual explanation gets thrown away and the upload fails
  // later with a bare, unexplained 401.
  if (data.canUpload === false || data.error) {
    throw new Error(
      `Bluesky won't accept a video from this account — ${
        data.message || data.error || "reason not given"
      }`
    );
  }
  // Any other non-2xx is genuinely inconclusive; let the upload be the judge.
}

interface JobStatus {
  jobId?: string;
  state?: string;
  blob?: unknown;
  error?: string;
  message?: string;
}

async function pollVideoJob(jobId: string): Promise<unknown> {
  const deadline = Date.now() + VIDEO_JOB_TIMEOUT_MS;
  for (;;) {
    const url = new URL(`${VIDEO_SERVICE}/xrpc/app.bsky.video.getJobStatus`);
    url.searchParams.set("jobId", jobId);
    // Unauthenticated — the job id is the capability.
    const res = await fetch(url);
    const data = (await res.json().catch(() => ({}))) as { jobStatus?: JobStatus };
    const job = data.jobStatus ?? {};

    // Check the blob before the error: re-uploading a video the service has
    // already processed reports "already_exists" but still hands back a
    // usable blob ref.
    if (job.blob) return job.blob;
    if (job.state === "JOB_STATE_FAILED" || job.error) {
      throw new Error(`Bluesky could not process the video — ${job.message || job.error || job.state}`);
    }
    if (Date.now() > deadline) {
      throw new Error("Bluesky video processing timed out — the video may still appear shortly.");
    }
    await new Promise((r) => setTimeout(r, VIDEO_POLL_MS));
  }
}

async function uploadVideo(
  session: Session,
  file: StoredFile
): Promise<{ blob: unknown; aspectRatio?: { width: number; height: number } }> {
  // Dimensions and duration are best-effort: ffprobe is optional here, so a
  // server without it still publishes — just without an aspect ratio, and
  // trusting the service to enforce the length cap.
  let aspectRatio: { width: number; height: number } | undefined;
  if (file.mime !== "url" && file.path) {
    const probe = await probeVideo(uploadPath(file.path));
    if (probe) {
      aspectRatio = { width: probe.width, height: probe.height };
      if (probe.duration > MAX_VIDEO_SECONDS) {
        throw new Error(
          `"${file.name}" is ${Math.round(probe.duration)}s — over Bluesky's ${MAX_VIDEO_SECONDS}s video limit`
        );
      }
    }
  }

  const buf = await readStoredFile(file);
  if (buf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(
      `"${file.name}" is ${(buf.byteLength / 1048576).toFixed(1)}MB — over Bluesky's ${MAX_VIDEO_BYTES / 1048576}MB video limit`
    );
  }

  await assertCanUploadVideo(session.accessJwt);
  const token = await getServiceAuth(
    session.accessJwt,
    `did:web:${await pdsHostFor(session)}`,
    "com.atproto.repo.uploadBlob"
  );

  const url = new URL(`${VIDEO_SERVICE}/xrpc/app.bsky.video.uploadVideo`);
  url.searchParams.set("did", session.did);
  url.searchParams.set("name", file.path || file.name || "video.mp4");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": file.mime.startsWith("video/") ? file.mime : "video/mp4",
      "content-length": String(buf.byteLength),
    },
    body: new Uint8Array(buf),
  });
  const raw = (await res.json().catch(() => ({}))) as { jobStatus?: JobStatus } & JobStatus;
  // Two response shapes: success nests the job under `jobStatus`, while the
  // already_exists 409 returns the same fields flat at the top level.
  const job: JobStatus = raw.jobStatus ?? raw;

  if (job.blob) return { blob: job.blob, aspectRatio };

  // A 409 here is NOT a failure. Bluesky deduplicates video by content, so
  // re-uploading identical bytes returns the id of the job that already
  // transcoded them — poll it and reuse the existing blob.
  if (job.jobId) return { blob: await pollVideoJob(job.jobId), aspectRatio };

  // Genuinely nothing to work with. Always keep the status code: a bare 401
  // means the service-auth audience was wrong, which no message would reveal.
  const detail = [raw.error, raw.message].filter(Boolean).join(": ");
  throw new Error(
    `Bluesky rejected the video upload (${res.status})${detail ? ` — ${detail}` : ""}`
  );
}

// ── Publishing ───────────────────────────────────────────────────────────────

export interface BlueskyPublishInput {
  appPassword: string;
  did: string; // captured at connect — see the identifier note below
  handle: string;
  type: PostType;
  media: StoredFile[];
  text: string;
}

export async function publishToBluesky(
  input: BlueskyPublishInput
): Promise<{ url: string; externalId: string }> {
  const { appPassword, did, handle, type, media, text } = input;

  if (type === "document") {
    throw new Error("Bluesky has no document posts");
  }

  // Sign in by DID, not handle: handles are renameable (and a rename would
  // otherwise break every future publish), DIDs are permanent.
  const session = await createSession(did || normalizeHandle(handle), appPassword);

  const record: Record<string, unknown> = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
  };

  const facets = detectFacets(text);
  if (facets.length > 0) record.facets = facets;

  // A record carries images or video, never both.
  if (type === "video") {
    const { blob, aspectRatio } = await uploadVideo(session, media[0]);
    record.embed = {
      $type: "app.bsky.embed.video",
      video: blob,
      ...(aspectRatio ? { aspectRatio } : {}),
    };
  } else if (type === "photos" && media.length > 0) {
    if (media.length > MAX_IMAGES) {
      throw new Error(`Bluesky allows at most ${MAX_IMAGES} images per post (got ${media.length})`);
    }
    const images = [];
    for (const file of media) {
      // alt text stays empty: the composer has no alt field, and inventing one
      // from the caption would be worse than none for a screen-reader user.
      images.push({ image: await uploadBlob(session, file), alt: "" });
    }
    record.embed = { $type: "app.bsky.embed.images", images };
  }

  const created = await xrpc("com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
    jwt: session.accessJwt,
  });

  // createRecord returns an at:// URI — the last path segment is the rkey the
  // public bsky.app permalink is built from.
  const uri = String(created.uri ?? "");
  const rkey = uri.split("/").pop() ?? "";
  return {
    url: rkey ? `https://bsky.app/profile/${session.handle}/post/${rkey}` : "",
    externalId: uri,
  };
}
