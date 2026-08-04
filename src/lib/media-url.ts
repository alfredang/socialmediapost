// Signed, expiring URLs for files under uploads/.
//
// /api/media used to serve any path under uploads/ with no authentication and
// no account scoping, so anyone holding a key could read any tenant's file,
// permanently. Keys are 48 bits of randomness so they aren't guessable, but
// they leak by design: they appear in API responses, in server logs, and in the
// URL handed to Instagram/Facebook/Threads so their servers can fetch the media.
//
// A session check is NOT the fix — those platform servers have no cookie, and
// requiring one would break pull-model publishing outright. Instead each URL
// carries an HMAC over the key and an expiry, so possession of a URL grants
// read access to ONE file for a bounded time.

import { createHmac, timingSafeEqual } from "crypto";
import { mediaSigningKey } from "./session";

// Long enough that no platform fetch can fail: Meta re-fetches while
// transcoding video, and a slow job can run for hours. A leaked URL stops
// working the next day.
export const MEDIA_URL_TTL_MS = 24 * 60 * 60 * 1000;

function computeSignature(key: string, expMs: number): string {
  return createHmac("sha256", mediaSigningKey())
    .update(`${key}\n${expMs}`)
    .digest("base64url");
}

/** "<key>?exp=…&sig=…" — the path-and-query half of a media URL. */
export function signMediaPath(key: string, ttlMs: number = MEDIA_URL_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  return `${key}?exp=${exp}&sig=${computeSignature(key, exp)}`;
}

export function verifyMediaSignature(
  key: string,
  exp: string | null,
  sig: string | null
): boolean {
  if (!exp || !sig) return false;

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;

  const expected = Buffer.from(computeSignature(key, expMs));
  const given = Buffer.from(sig);
  // timingSafeEqual throws on a length mismatch, so check that first — and
  // compare lengths rather than returning early on content.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
