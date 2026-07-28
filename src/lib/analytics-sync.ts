// Real analytics collection.
//
// This is the ONLY writer of AnalyticsSnapshot and PostMetric rows. Every
// number originates from a platform API call made with the account's own OAuth
// token. Nothing is estimated, interpolated or backfilled: a metric the
// platform won't give us is stored as NULL, and a platform with no working
// collector produces no rows at all.
//
// Coverage today (limited by what each API actually exposes to a non-partner
// app, not by convenience):
//
//   Instagram  account: followers, reach, views     posts: likes, comments, views, shares
//   Facebook   account: followers, reach, impressions  posts: likes, comments, shares, views
//   TikTok     account: followers, likes            posts: views, likes, comments, shares
//   LinkedIn   account: — (member insights are partner-gated)  posts: likes, comments
//
// Historical data is NOT reconstructed. Snapshots begin the day the sync first
// runs for an account, because that is the first day we actually measured.

import type { SocialAccount } from "@prisma/client";
import { db } from "./db";
import { ensureFreshToken } from "./token-refresh";
import { TokenExpiredError } from "./oauth-errors";
import * as instagram from "./instagram";
import * as facebook from "./facebook";
import * as linkedin from "./linkedin";
import * as tiktok from "./tiktok";

export interface AccountMetrics {
  followers?: number;
  reach?: number;
  impressions?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

// Platforms with a working account-level collector. Anything absent here is
// skipped entirely — no snapshot row is written for it.
const ACCOUNT_COLLECTORS: Record<
  string,
  (account: SocialAccount) => Promise<AccountMetrics>
> = {
  instagram: (a) => instagram.fetchAccountMetrics(a.externalUserId!, a.accessToken!),
  facebook: (a) => facebook.fetchPageMetrics(a.externalUserId!, a.accessToken!),
  tiktok: (a) => tiktok.fetchAccountMetrics(a.accessToken!),
};

export interface PostMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

const POST_COLLECTORS: Record<
  string,
  (account: SocialAccount, externalId: string) => Promise<PostMetrics>
> = {
  instagram: (a, id) => instagram.fetchMediaMetrics(id, a.accessToken!),
  facebook: (a, id) => facebook.fetchPostMetrics(id, a.accessToken!),
  linkedin: (a, id) => linkedin.fetchPostMetrics(a.accessToken!, id),
  tiktok: (a, id) => tiktok.fetchVideoMetrics(a.accessToken!, id),
};

export function hasAccountCollector(platform: string): boolean {
  return platform in ACCOUNT_COLLECTORS;
}

export function hasPostCollector(platform: string): boolean {
  return platform in POST_COLLECTORS;
}

function usable(account: SocialAccount): boolean {
  return account.status === "connected" && Boolean(account.accessToken);
}

// An expired token means the user must reconnect — flag the account so the UI
// prompts for it instead of silently reporting stale numbers forever.
async function markNeedsReauth(accountId: string) {
  await db.socialAccount
    .update({ where: { id: accountId }, data: { status: "needs_reauth" } })
    .catch(() => {});
}

function hasAnyValue(metrics: AccountMetrics): boolean {
  return Object.values(metrics).some((v) => typeof v === "number");
}

// Collects today's account-level numbers for one connected account and upserts
// the day's snapshot. Returns false when nothing measurable came back.
export async function syncAccountSnapshot(account: SocialAccount): Promise<boolean> {
  const collect = ACCOUNT_COLLECTORS[account.platform];
  if (!collect || !usable(account)) return false;

  let metrics: AccountMetrics;
  try {
    const fresh = await ensureFreshToken(account);
    metrics = await collect(fresh);
  } catch (err) {
    if (err instanceof TokenExpiredError) await markNeedsReauth(account.id);
    else console.error(`[analytics] ${account.platform} account sync failed:`, err);
    return false;
  }

  // Nothing readable (scopes not granted, brand-new account) — write no row.
  if (!hasAnyValue(metrics)) return false;

  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  await db.analyticsSnapshot.upsert({
    where: {
      profileId_platform_date: { profileId: account.profileId, platform: account.platform, date },
    },
    create: { profileId: account.profileId, platform: account.platform, date, ...metrics },
    update: { ...metrics, collectedAt: new Date() },
  });
  return true;
}

// Refreshes engagement numbers for posts published in the last 30 days. Older
// posts stop being polled — their last recorded metrics stand.
export async function syncPostMetrics(account: SocialAccount): Promise<number> {
  const collect = POST_COLLECTORS[account.platform];
  if (!collect || !usable(account)) return 0;

  const since = new Date(Date.now() - 30 * 86400000);
  const targets = await db.postTarget.findMany({
    where: {
      platform: account.platform,
      status: "published",
      externalId: { not: null },
      publishedAt: { gte: since },
      post: { profileId: account.profileId },
    },
    select: { id: true, externalId: true },
    take: 200,
  });
  if (targets.length === 0) return 0;

  let fresh: SocialAccount;
  try {
    fresh = await ensureFreshToken(account);
  } catch (err) {
    if (err instanceof TokenExpiredError) await markNeedsReauth(account.id);
    return 0;
  }

  let written = 0;
  for (const target of targets) {
    try {
      const metrics = await collect(fresh, target.externalId!);
      if (!hasAnyValue(metrics)) continue;
      await db.postMetric.create({
        data: {
          targetId: target.id,
          views: metrics.views ?? 0,
          likes: metrics.likes ?? 0,
          comments: metrics.comments ?? 0,
          shares: metrics.shares ?? 0,
        },
      });
      written++;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        await markNeedsReauth(account.id);
        break;
      }
      console.error(`[analytics] ${account.platform} post metrics failed:`, err);
    }
  }
  return written;
}

export interface SyncReport {
  accountsChecked: number;
  snapshotsWritten: number;
  postMetricsWritten: number;
}

// One full pass over every connected account. Safe to call repeatedly — the
// day's snapshot is upserted, so re-running just refreshes today's numbers.
export async function syncAllAnalytics(): Promise<SyncReport> {
  const accounts = await db.socialAccount.findMany({ where: { status: "connected" } });
  const report: SyncReport = { accountsChecked: 0, snapshotsWritten: 0, postMetricsWritten: 0 };

  for (const account of accounts) {
    if (!hasAccountCollector(account.platform) && !hasPostCollector(account.platform)) continue;
    report.accountsChecked++;
    if (await syncAccountSnapshot(account)) report.snapshotsWritten++;
    report.postMetricsWritten += await syncPostMetrics(account);
  }
  return report;
}
