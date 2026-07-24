// Shared plumbing for the /api/auth/<platform> connect routes. Every platform
// follows the same shape: a start route that redirects to the provider (or
// errors clearly when its credentials aren't configured), and a callback that
// verifies the signed state and upserts the SocialAccount.
//
// Two callers can start a connect:
//   1. A signed-in owner from /users (session cookie + ?profileId=).
//   2. A whitelabel end user from /connect (?connect_token=<profile JWT>), who
//      has no account here. Both paths run the SAME real OAuth — an account is
//      only ever created from a provider's token response, never from a
//      self-declared handle.
// Results surface as ?connected=<platform>&status=<code> on whichever page the
// flow started from.

import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import {
  getSessionAccountId,
  signOAuthState,
  verifyOAuthState,
  verifyProfileJwt,
} from "./session";
import { appBaseUrl } from "./base-url";

// Carries the whitelabel connect token across the provider round-trip so the
// callback can send the user back to their /connect link. Short-lived and
// one-shot: cleared as soon as the callback redirects.
const RETURN_COOKIE = "sp_connect_return";

// Status codes the toast understands:
// connected | not-configured | denied | failed | invalid-state |
// profile-not-found | no-pages | select-page | enter-page-id (Facebook-specific)
export function connectRedirect(
  base: string,
  platform: string,
  status: string,
  returnTo?: string | null
) {
  const url = returnTo
    ? new URL(
        `/connect?token=${encodeURIComponent(returnTo)}&connected=${platform}&status=${status}`,
        base
      )
    : new URL(`/users?connected=${platform}&status=${status}`, base);
  const res = NextResponse.redirect(url);
  if (returnTo) res.cookies.delete(RETURN_COOKIE);
  return res;
}

// Resolves who is starting the connect and which profile they're connecting to.
// Either a signed-in owner or a valid whitelabel connect token — nothing else.
async function resolveInitiator(
  req: NextRequest
): Promise<
  | { kind: "session"; accountId: string; profileId: string }
  | { kind: "connect-link"; accountId: string; profileId: string; token: string }
  | { kind: "unauthorized" }
  | { kind: "profile-not-found" }
> {
  const connectToken = req.nextUrl.searchParams.get("connect_token");
  if (connectToken) {
    const payload = await verifyProfileJwt(connectToken);
    if (!payload) return { kind: "unauthorized" };
    const profile = await db.profile.findUnique({
      where: { accountId_name: { accountId: payload.accountId, name: payload.profile } },
    });
    if (!profile) return { kind: "profile-not-found" };
    return {
      kind: "connect-link",
      accountId: payload.accountId,
      profileId: profile.id,
      token: connectToken,
    };
  }

  const accountId = await getSessionAccountId();
  if (!accountId) return { kind: "unauthorized" };
  const profileId = req.nextUrl.searchParams.get("profileId") ?? "";
  const profile = await db.profile.findFirst({ where: { id: profileId, accountId } });
  if (!profile) return { kind: "profile-not-found" };
  return { kind: "session", accountId, profileId: profile.id };
}

// Start-route logic: caller + profile checks, then the real OAuth redirect.
export async function startConnect(
  req: NextRequest,
  opts: {
    platform: string;
    configured: () => boolean;
    // May return extra cookies to set on the redirect (e.g. TikTok's PKCE verifier).
    authorizeUrl: (
      origin: string,
      state: string
    ) => string | { url: string; cookies: { name: string; value: string }[] };
  }
): Promise<NextResponse> {
  // Browser-facing redirects must use the public base URL — behind a tunnel or
  // proxy, req.url resolves to the internal address (localhost:3000).
  const base = appBaseUrl(req.nextUrl.origin);

  const initiator = await resolveInitiator(req);
  if (initiator.kind === "unauthorized") {
    return NextResponse.redirect(new URL("/login", base));
  }
  if (initiator.kind === "profile-not-found") {
    return connectRedirect(base, opts.platform, "profile-not-found");
  }

  const returnTo = initiator.kind === "connect-link" ? initiator.token : null;

  if (!opts.configured()) {
    return connectRedirect(base, opts.platform, "not-configured", returnTo);
  }

  const state = await signOAuthState(initiator.accountId, initiator.profileId);
  const auth = opts.authorizeUrl(req.nextUrl.origin, state);
  const res = NextResponse.redirect(typeof auth === "string" ? auth : auth.url);

  const extraCookies = typeof auth === "string" ? [] : auth.cookies;
  const cookies = returnTo
    ? [...extraCookies, { name: RETURN_COOKIE, value: returnTo }]
    : extraCookies;
  for (const c of cookies) {
    res.cookies.set(c.name, c.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600, // matches the 10-min OAuth state expiry
    });
  }
  return res;
}

export interface CallbackContext {
  ok: true;
  base: string;
  code: string;
  profile: { id: string };
  // Redirects back to wherever the flow started (/users or the /connect link).
  redirect: (status: string) => NextResponse;
}

// Callback preamble: provider error param, signed-state verification, and the
// profile lookup. Returns the pieces the platform callback needs.
export async function resolveCallback(
  req: NextRequest,
  platform: string
): Promise<{ ok: false; res: NextResponse } | CallbackContext> {
  const base = appBaseUrl(req.nextUrl.origin);
  const returnTo = req.cookies.get(RETURN_COOKIE)?.value ?? null;
  const fail = (status: string) => ({
    ok: false as const,
    res: connectRedirect(base, platform, status, returnTo),
  });

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("denied");

  const code = params.get("code");
  const verified = await verifyOAuthState(params.get("state") ?? "");
  if (!code || !verified) return fail("invalid-state");

  const profile = await db.profile.findFirst({
    where: { id: verified.profileId, accountId: verified.accountId },
  });
  if (!profile) return fail("profile-not-found");

  return {
    ok: true,
    base,
    code,
    profile,
    redirect: (status: string) => connectRedirect(base, platform, status, returnTo),
  };
}
