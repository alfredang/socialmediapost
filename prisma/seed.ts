// Bootstrap seed — creates ONE real account so a fresh install has somewhere to
// sign in. It is opt-in (SEED_DEMO_DATA=true) and never invents data:
//
//   * no fabricated analytics — snapshots only ever come from the real platform
//     sync in src/lib/analytics-sync.ts
//   * no fabricated posts or permalinks — History reflects real publishes only
//   * no social accounts — those exist only after a real OAuth connect
//
// Credentials come from the environment. When SEED_ADMIN_PASSWORD or
// SEED_ADMIN_API_KEY are unset a random one is generated and printed ONCE.

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function generatedPassword(): string {
  return randomBytes(12).toString("base64url");
}

function generatedApiKey(): string {
  return "up_" + randomBytes(24).toString("hex");
}

async function main() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("[seed] SEED_DEMO_DATA is not \"true\" — skipping (nothing was written).");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "[seed] SEED_ADMIN_EMAIL is required when SEED_DEMO_DATA=true — refusing to invent an account."
    );
  }

  const existing = await db.account.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] ${email} already exists — leaving it untouched.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || generatedPassword();
  const apiKey = process.env.SEED_ADMIN_API_KEY || generatedApiKey();

  const account = await db.account.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME || null,
      role: "admin",
      passwordHash: await bcrypt.hash(password, 10),
      plan: process.env.SEED_ADMIN_PLAN || "free",
    },
  });

  await db.apiKey.create({
    data: {
      accountId: account.id,
      label: "Bootstrap Key",
      hashedKey: createHash("sha256").update(apiKey).digest("hex"),
      prefix: apiKey.slice(0, 10),
    },
  });

  const profileName = process.env.SEED_PROFILE_NAME || "default";
  const profile = await db.profile.create({
    data: { accountId: account.id, name: profileName },
  });
  await db.queueSetting.create({
    data: {
      profileId: profile.id,
      ...(process.env.SEED_TIMEZONE ? { timezone: process.env.SEED_TIMEZONE } : {}),
    },
  });

  console.log(`[seed] created admin account ${email} with profile "${profileName}".`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`[seed] generated password (shown once): ${password}`);
  }
  if (!process.env.SEED_ADMIN_API_KEY) {
    console.log(`[seed] generated API key (shown once): ${apiKey}`);
  }
  console.log("[seed] connect social accounts from the Users page — none were created.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
