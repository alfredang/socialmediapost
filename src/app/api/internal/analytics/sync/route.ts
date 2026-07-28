import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import {
  hasAccountCollector,
  hasPostCollector,
  syncAccountSnapshot,
  syncPostMetrics,
} from "@/lib/analytics-sync";

// POST — pull fresh numbers from the platform APIs for this account's connected
// social accounts, on demand. The scheduler does this every 6h anyway; this
// exists so the dashboard's "Sync now" button isn't a lie.
export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const accounts = await db.socialAccount.findMany({
    where: { status: "connected", profile: { accountId: auth } },
  });

  let snapshots = 0;
  let postMetrics = 0;
  let checked = 0;
  for (const account of accounts) {
    if (!hasAccountCollector(account.platform) && !hasPostCollector(account.platform)) continue;
    checked++;
    if (await syncAccountSnapshot(account)) snapshots++;
    postMetrics += await syncPostMetrics(account);
  }

  return NextResponse.json({
    success: true,
    accounts_checked: checked,
    snapshots_written: snapshots,
    post_metrics_written: postMetrics,
  });
}
