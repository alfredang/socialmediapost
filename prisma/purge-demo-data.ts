// Removes the fabricated rows the pre-2026-07-24 seed wrote into existing
// databases: demo/admin accounts with published-repo credentials, invented
// "published" posts with fake permalinks, token-less SocialAccounts, and
// randomly generated analytics history.
//
//   npx tsx prisma/purge-demo-data.ts            # report only (default)
//   npx tsx prisma/purge-demo-data.ts --apply    # actually delete
//
// Deleting is opt-in because only you can know whether a real person has since
// signed in as one of these addresses.

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// The credentials the old seed hardcoded — all published in the git history.
//
// Synthetic accounts are deleted outright. The admin account is NOT deleted:
// its address belongs to a real person and may now hold real data. Instead its
// password is invalidated, so the published "admin1234" stops working while the
// account survives — the owner recovers it with an email sign-in code.
const LEAKED_EMAILS = ["demo@example.com", "demo.google@example.com"];
const LOCK_EMAILS = ["angch@tertiaryinfotech.com"];
const LEAKED_API_KEYS = [
  "up_demo_1234567890abcdef1234567890abcdef",
  "up_alfred_1234567890abcdef1234567890abcd",
];

// Seeded posts pointed at this fake permalink shape: <platform>.com/example/<id>
const FAKE_URL = "%.com/example/%";

async function main() {
  const apply = process.argv.includes("--apply");
  const label = apply ? "DELETING" : "would delete";

  const accounts = await db.account.findMany({
    where: { email: { in: LEAKED_EMAILS } },
    select: { id: true, email: true },
  });
  console.log(`${label}: ${accounts.length} account(s) with published credentials`);
  for (const a of accounts) console.log(`  - ${a.email}`);

  const locked = await db.account.findMany({
    where: { email: { in: LOCK_EMAILS } },
    select: { id: true, email: true, role: true },
  });
  const rotated: { email: string; password: string }[] = [];
  console.log(
    `${apply ? "ROTATING" : "would rotate"}: ${locked.length} account(s) whose password is published ` +
      `(kept, password replaced — the new one is printed once below)`
  );
  for (const a of locked) console.log(`  - ${a.email} (${a.role})`);

  const leakedKeys = await db.apiKey.findMany({
    where: {
      hashedKey: { in: LEAKED_API_KEYS.map((k) => createHash("sha256").update(k).digest("hex")) },
    },
    select: { id: true, label: true, accountId: true },
  });
  console.log(`${label}: ${leakedKeys.length} API key(s) whose plaintext is in the repo`);

  // Fabricated post targets — real publishes never produce this URL shape.
  const fakeTargets = await db.postTarget.findMany({
    where: { externalUrl: { contains: "/example/" } },
    select: { postId: true },
  });
  const fakePostIds = [...new Set(fakeTargets.map((t) => t.postId))];
  console.log(`${label}: ${fakePostIds.length} post(s) with fabricated permalinks (${FAKE_URL})`);

  // Snapshots that predate the real sync: the old seed wrote 61 days of history
  // per platform on first run, which the real collector never backfills.
  const snapshotCount = await db.analyticsSnapshot.count();
  console.log(`${label}: ${snapshotCount} analytics snapshot(s) — all pre-sync rows were generated`);

  // SocialAccounts marked connected but holding no token can never publish.
  const tokenless = await db.socialAccount.count({
    where: { status: "connected", accessToken: null },
  });
  console.log(`${label}: ${tokenless} token-less "connected" social account(s)`);

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply to delete.");
    return;
  }

  // Cascades handle profiles, posts, targets, metrics and snapshots.
  if (accounts.length > 0) {
    await db.account.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } });
  }

  // Replace the published password with a fresh strong one, printed once here.
  // Rotating to a known-good password (rather than an unrecoverable hash) keeps
  // the owner from depending on email delivery to get back in.
  for (const a of locked) {
    const replacement = randomBytes(12).toString("base64url");
    await db.account.update({
      where: { id: a.id },
      data: { passwordHash: await bcrypt.hash(replacement, 10) },
    });
    rotated.push({ email: a.email, password: replacement });
  }
  if (leakedKeys.length > 0) {
    await db.apiKey.deleteMany({ where: { id: { in: leakedKeys.map((k) => k.id) } } });
  }
  if (fakePostIds.length > 0) {
    await db.post.deleteMany({ where: { id: { in: fakePostIds } } });
  }
  await db.analyticsSnapshot.deleteMany({});
  await db.socialAccount.deleteMany({ where: { status: "connected", accessToken: null } });

  console.log("\nDone. Reconnect social accounts from the Users page; analytics rebuilds from the next sync.");
  for (const r of rotated) {
    console.log(`New password for ${r.email} (shown once): ${r.password}`);
  }
  console.log(
    "Also rotate SESSION_SECRET if it was ever left unset — the old default is published in this repo."
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
