import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "socialpost-dev-secret-change-in-production"
);

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
