import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCallback } from "@/lib/connect-flow";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchGrantedPageIds,
  fetchPageDirect,
  fetchPages,
  fetchPermissions,
  FacebookMeta,
} from "@/lib/facebook";

// GET /api/auth/facebook/callback — completes the Facebook OAuth flow. The
// Graph API only posts to Pages, so the flow ends by picking one: a single
// managed Page connects immediately; multiple Pages park the account in
// pending_page and /users shows a Page picker (PATCH /api/internal/social-accounts).
export async function GET(req: NextRequest) {
  const cb = await resolveCallback(req, "facebook");
  if (!cb.ok) return cb.res;

  try {
    const short = await exchangeCodeForToken(req.nextUrl.origin, cb.code);
    const long = await exchangeForLongLivedToken(short.access_token);
    let pages = await fetchPages(long.access_token);
    if (pages.length === 0) {
      // Meta quirk: /me/accounts can be empty even though the grant covers
      // Pages. Recover the granted Page IDs via token introspection and
      // resolve each Page directly.
      const ids = await fetchGrantedPageIds(long.access_token).catch(() => []);
      const resolved = [];
      for (const id of ids) {
        try {
          resolved.push(await fetchPageDirect(long.access_token, id));
        } catch {
          /* skip pages the token can't actually read */
        }
      }
      pages = resolved;
      if (pages.length > 0) {
        console.log(`[facebook] /me/accounts empty; recovered ${pages.length} page(s) via debug_token`);
      }
    }
    if (pages.length === 0) {
      // Zero pages despite consent — log what the token really carries.
      const perms = await fetchPermissions(long.access_token).catch(() => []);
      console.error(
        "[facebook] /me/accounts returned no pages; token permissions:",
        perms.map((p) => `${p.permission}=${p.status}`).join(", ") || "(none)"
      );
      // Meta sometimes hides Pages from /me/accounts (new-account quirk) even
      // though direct Page fetches work. Park the connection and let the user
      // enter their Page ID on /users instead of dead-ending.
      const data = {
        handle: "facebook",
        displayName: "Enter Page ID",
        externalUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
        meta: JSON.stringify({ userToken: long.access_token, pages: [] }),
        status: "pending_page",
      };
      await db.socialAccount.upsert({
        where: { profileId_platform: { profileId: cb.profile.id, platform: "facebook" } },
        update: data,
        create: { profileId: cb.profile.id, platform: "facebook", ...data },
      });
      return cb.redirect("enter-page-id");
    }

    const meta: FacebookMeta = { userToken: long.access_token, pages };
    const where = {
      profileId_platform: { profileId: cb.profile.id, platform: "facebook" },
    } as const;

    if (pages.length === 1) {
      // Only one Page — connect it directly. Page tokens derived from a
      // long-lived user token do not expire, so tokenExpiresAt stays null.
      const page = pages[0];
      const data = {
        handle: page.name,
        displayName: page.name,
        externalUserId: page.id,
        accessToken: page.access_token,
        tokenExpiresAt: null,
        meta: JSON.stringify(meta),
        status: "connected",
      };
      await db.socialAccount.upsert({
        where,
        update: data,
        create: { profileId: cb.profile.id, platform: "facebook", ...data },
      });
      return cb.redirect("connected");
    }

    // Multiple Pages — park the connection until the user picks one.
    const data = {
      handle: "facebook",
      displayName: "Choose a Page",
      externalUserId: null,
      accessToken: null,
      tokenExpiresAt: null,
      meta: JSON.stringify(meta),
      status: "pending_page",
    };
    await db.socialAccount.upsert({
      where,
      update: data,
      create: { profileId: cb.profile.id, platform: "facebook", ...data },
    });
    return cb.redirect("select-page");
  } catch (err) {
    console.error("[facebook] connect failed:", err);
    return cb.redirect("failed");
  }
}
