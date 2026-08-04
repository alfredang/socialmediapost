import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Symmetric encryption for settings the admin UI stores in the database —
// SMTP passwords, OAuth client secrets. These must be recoverable (unlike API
// keys, which are hashed in apikey.ts and only ever compared), so they are
// encrypted rather than digested.
//
// The key is derived from SESSION_SECRET. Rotating SESSION_SECRET therefore
// makes existing ciphertexts undecryptable — decrypt() returns null instead of
// throwing so a rotated instance degrades to "setting not configured" and the
// admin can re-enter it, rather than crashing every request that reads config.

const ALGO = "aes-256-gcm";
const SALT = "socialpost.settings.v1"; // fixed: the derived key must be stable across restarts

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set to store encrypted settings");
  return scryptSync(secret, SALT, 32);
}

// Returns `v1:<iv>:<authTag>:<ciphertext>`, all base64url.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

// Null when the value is malformed, truncated, or was encrypted under a
// different SESSION_SECRET. Callers treat null as "not configured".
export function decrypt(payload: string): string | null {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
