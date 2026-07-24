import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "./db";

// Every session cookie, whitelabel connect link and OAuth state is signed with
// this key. A published default would let anyone forge a session for any
// account, so production must supply its own — no fallback, ever.
function sessionSecret(): Uint8Array {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) {
    return new TextEncoder().encode(configured);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      configured
        ? "SESSION_SECRET must be at least 32 characters."
        : "SESSION_SECRET is not set — refusing to sign sessions with a default key."
    );
  }
  if (configured) return new TextEncoder().encode(configured);
  // Development only: a per-process random key. Restarting invalidates local
  // sessions, which is the correct trade for never shipping a known secret.
  if (!devSecret) {
    devSecret = new TextEncoder().encode(randomBytes(32).toString("hex"));
    console.warn("[auth] SESSION_SECRET is not set — using a random dev key (sessions reset on restart).");
  }
  return devSecret;
}

let devSecret: Uint8Array | null = null;

const secret = sessionSecret();

const COOKIE = "sp_session";

export async function createSession(accountId: string) {
  const token = await new SignJWT({ sub: accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionAccountId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function getSessionAccount() {
  const id = await getSessionAccountId();
  if (!id) return null;
  return db.account.findUnique({ where: { id } });
}

// Dashboard pages render concurrently with the layout, so they can't rely on
// the layout's redirect to spare them a null account — a valid cookie whose
// account was deleted still reaches the page. This redirects and narrows the
// type, replacing the fragile `(await getSessionAccount())!` assertion that
// threw "Cannot read properties of null" in that window.
export async function requireSessionAccount() {
  const account = await getSessionAccount();
  if (!account) redirect("/login");
  return account;
}

// Profile-share JWTs for the whitelabel users API
export async function signProfileJwt(accountId: string, profileName: string) {
  return new SignJWT({ sub: accountId, profile: profileName, kind: "profile-share" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function verifyProfileJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind !== "profile-share") return null;
    return { accountId: payload.sub as string, profile: payload.profile as string };
  } catch {
    return null;
  }
}

// Short-lived CSRF `state` for the Instagram connect OAuth round-trip.
// Binds the callback to the signed-in account + the profile being connected.
export async function signOAuthState(accountId: string, profileId: string) {
  return new SignJWT({ sub: accountId, profileId, kind: "oauth-state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyOAuthState(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind !== "oauth-state") return null;
    return { accountId: payload.sub as string, profileId: payload.profileId as string };
  } catch {
    return null;
  }
}
