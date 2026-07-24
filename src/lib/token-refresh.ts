// Keeps SocialAccount OAuth tokens usable at publish time.
//
// TikTok is the only platform with programmatic refresh (24h access token,
// 365d refresh token). Instagram (~60d) and LinkedIn (~60d) have no
// self-service refresh — on expiry the account flips to needs_reauth and the
// user reconnects from the Users page. Facebook Page tokens don't expire
// (tokenExpiresAt is null), so they skip this entirely.

import type { SocialAccount } from "@prisma/client";
import { db } from "./db";
import { refreshAccessToken } from "./tiktok";
import { PLATFORM_MAP } from "./platforms";

const SKEW_MS = 5 * 60 * 1000; // refresh anything expiring within 5 minutes

export async function ensureFreshToken(account: SocialAccount): Promise<SocialAccount> {
  if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now() + SKEW_MS) {
    return account;
  }

  if (account.platform === "tiktok" && account.refreshToken) {
    try {
      const tokens = await refreshAccessToken(account.refreshToken);
      return await db.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          meta: JSON.stringify({
            refreshExpiresAt: new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString(),
          }),
        },
      });
    } catch {
      /* refresh token expired/revoked — fall through to needs_reauth */
    }
  }

  await db.socialAccount.update({
    where: { id: account.id },
    data: { status: "needs_reauth" },
  });
  const name = PLATFORM_MAP[account.platform]?.name ?? account.platform;
  throw new Error(`${name} token expired — reconnect the account on the Users page`);
}
