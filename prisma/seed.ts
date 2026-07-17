import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_KEY = "up_demo_1234567890abcdef1234567890abcdef";
const ALFRED_KEY = "up_alfred_1234567890abcdef1234567890abcd";

const PLATFORM_HANDLES: Record<string, { handle: string; displayName: string }> = {
  tiktok: { handle: "alfred.tertiary", displayName: "alfred.tertiary" },
  instagram: { handle: "dr_alfred_ang", displayName: "dr_alfred_ang" },
  linkedin: { handle: "dr-alfred-ang", displayName: "Dr. Alfred Ang" },
  youtube: { handle: "TertiaryCourses", displayName: "Tertiary Courses" },
  facebook: { handle: "tertiaryinfotech", displayName: "Ang Chew Hoe" },
  x: { handle: "tertiaryinfotech", displayName: "Tertiary Infotech" },
};

const SAMPLE_POSTS = [
  { title: "WSQ - CompTIA Certified Cloud Essentials", desc: "🚀 Learn to make smarter, tech-driven cloud decisions! #cloud #comptia", platforms: ["linkedin", "facebook"], daysAgo: 0 },
  { title: "WSQ - Mastering Prompt Engineering", desc: "Discover how to craft impactful prompts for AI models. #ai #promptengineering", platforms: ["linkedin", "facebook"], daysAgo: 1 },
  { title: "WSQ – Developing Advanced Machine Learning Models", desc: "Master pattern recognition with hands-on ML training. #machinelearning", platforms: ["linkedin", "instagram"], daysAgo: 2 },
  { title: "Python for Data Science Bootcamp", desc: "📊 From zero to data hero in 3 days. #python #datascience", platforms: ["linkedin", "facebook", "instagram"], daysAgo: 4 },
  { title: "Generative AI for Business Leaders", desc: "✨ Practical GenAI strategies for your team. #genai #business", platforms: ["linkedin", "youtube"], daysAgo: 6 },
  { title: "n8n Workflow Automation Masterclass", desc: "🔧 Automate everything without code. #n8n #automation", platforms: ["tiktok", "instagram", "youtube"], daysAgo: 8 },
  { title: "Docker & Kubernetes Fundamentals", desc: "🐳 Containerize your first app today. #docker #kubernetes", platforms: ["linkedin", "facebook"], daysAgo: 10 },
  { title: "WSQ - Data Visualization with Tableau", desc: "📈 Turn raw data into beautiful dashboards. #tableau #dataviz", platforms: ["linkedin", "instagram"], daysAgo: 12 },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const account = await db.account.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      passwordHash,
      plan: "basic",
    },
  });

  await db.apiKey.upsert({
    where: { hashedKey: createHash("sha256").update(DEMO_KEY).digest("hex") },
    update: {},
    create: {
      accountId: account.id,
      label: "Default Key",
      hashedKey: createHash("sha256").update(DEMO_KEY).digest("hex"),
      prefix: DEMO_KEY.slice(0, 10),
    },
  });

  const profile = await db.profile.upsert({
    where: { accountId_name: { accountId: account.id, name: "tertiaryinfotech" } },
    update: {},
    create: { accountId: account.id, name: "tertiaryinfotech" },
  });

  for (const [platform, info] of Object.entries(PLATFORM_HANDLES)) {
    await db.socialAccount.upsert({
      where: { profileId_platform: { profileId: profile.id, platform } },
      update: {},
      create: { profileId: profile.id, platform, handle: info.handle, displayName: info.displayName },
    });
  }

  await db.queueSetting.upsert({
    where: { profileId: profile.id },
    update: {},
    create: { profileId: profile.id },
  });

  // Historical published posts + metrics
  const existingPosts = await db.post.count({ where: { profileId: profile.id } });
  if (existingPosts === 0) {
    for (const sp of SAMPLE_POSTS) {
      const created = new Date(Date.now() - sp.daysAgo * 86400000 - 7 * 3600000);
      await db.post.create({
        data: {
          profileId: profile.id,
          type: "photos",
          title: sp.title,
          description: sp.desc,
          mediaFiles: JSON.stringify([{ path: "", name: "photo.jpg", size: 146000 + Math.floor(Math.random() * 800000), mime: "image/jpeg" }]),
          status: "published",
          source: "api",
          createdAt: created,
          targets: {
            create: sp.platforms.map((platform) => ({
              platform,
              adaptedTitle: sp.title,
              adaptedBody: sp.desc,
              status: "published",
              externalUrl: `https://www.${platform === "x" ? "x" : platform}.com/example/${Math.random().toString(36).slice(2, 10)}`,
              externalId: Math.random().toString(36).slice(2, 12),
              publishedAt: created,
              metrics: {
                create: {
                  views: 400 + Math.floor(Math.random() * 4000),
                  likes: 30 + Math.floor(Math.random() * 300),
                  comments: Math.floor(Math.random() * 40),
                  shares: Math.floor(Math.random() * 25),
                  createdAt: created,
                },
              },
            })),
          },
        },
      });
    }
  }

  // 60 days of analytics history per connected platform
  const existingSnaps = await db.analyticsSnapshot.count({ where: { profileId: profile.id } });
  if (existingSnaps === 0) {
    const base: Record<string, number> = { tiktok: 3400, instagram: 5200, linkedin: 2900, youtube: 8100, facebook: 4400 };
    for (const platform of Object.keys(PLATFORM_HANDLES)) {
      let followers = base[platform];
      for (let i = 60; i >= 0; i--) {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - i);
        followers += Math.floor(Math.random() * 20);
        const impressions = 3000 + Math.floor(Math.random() * 4500);
        await db.analyticsSnapshot.create({
          data: {
            profileId: profile.id,
            platform,
            date,
            followers,
            reach: Math.round(impressions * (0.55 + Math.random() * 0.2)),
            impressions,
            views: Math.round(impressions * (0.4 + Math.random() * 0.3)),
            likes: 80 + Math.floor(Math.random() * 260),
            comments: 5 + Math.floor(Math.random() * 45),
            shares: 2 + Math.floor(Math.random() * 22),
          },
        });
      }
    }
  }

  const invoiceCount = await db.invoice.count({ where: { accountId: account.id } });
  if (invoiceCount === 0) {
    await db.invoice.create({
      data: {
        accountId: account.id,
        number: "FAC-10545",
        total: 144.0,
        status: "paid",
        createdAt: new Date("2025-11-16"),
      },
    });
  }

  // --- Admin account: Dr. Alfred Ang ---
  const alfred = await db.account.upsert({
    where: { email: "angch@tertiaryinfotech.com" },
    update: { name: "Dr. Alfred Ang", role: "admin" },
    create: {
      email: "angch@tertiaryinfotech.com",
      name: "Dr. Alfred Ang",
      role: "admin",
      passwordHash: await bcrypt.hash("admin1234", 10),
      plan: "professional",
    },
  });
  await db.apiKey.upsert({
    where: { hashedKey: createHash("sha256").update(ALFRED_KEY).digest("hex") },
    update: {},
    create: {
      accountId: alfred.id,
      label: "Admin Key",
      hashedKey: createHash("sha256").update(ALFRED_KEY).digest("hex"),
      prefix: ALFRED_KEY.slice(0, 10),
    },
  });
  const alfredProfile = await db.profile.upsert({
    where: { accountId_name: { accountId: alfred.id, name: "tertiarycourses" } },
    update: {},
    create: { accountId: alfred.id, name: "tertiarycourses" },
  });
  await db.socialAccount.upsert({
    where: { profileId_platform: { profileId: alfredProfile.id, platform: "linkedin" } },
    update: {},
    create: {
      profileId: alfredProfile.id,
      platform: "linkedin",
      handle: "angchewhoe",
      displayName: "Dr. Alfred Ang",
    },
  });
  await db.socialAccount.upsert({
    where: { profileId_platform: { profileId: alfredProfile.id, platform: "facebook" } },
    update: {},
    create: {
      profileId: alfredProfile.id,
      platform: "facebook",
      handle: "TertiaryCourses",
      displayName: "Tertiary Courses",
    },
  });
  await db.queueSetting.upsert({
    where: { profileId: alfredProfile.id },
    update: {},
    create: { profileId: alfredProfile.id, timezone: "Asia/Singapore" },
  });

  // Analytics history for every connected account that has none yet
  const allAccounts = await db.socialAccount.findMany();
  for (const acc of allAccounts) {
    const existing = await db.analyticsSnapshot.count({
      where: { profileId: acc.profileId, platform: acc.platform },
    });
    if (existing > 0) continue;
    let followers = 1500 + Math.floor(Math.random() * 6000);
    for (let i = 60; i >= 0; i--) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - i);
      followers += Math.floor(Math.random() * 20);
      const impressions = 3000 + Math.floor(Math.random() * 4500);
      await db.analyticsSnapshot.create({
        data: {
          profileId: acc.profileId,
          platform: acc.platform,
          date,
          followers,
          reach: Math.round(impressions * (0.55 + Math.random() * 0.2)),
          impressions,
          views: Math.round(impressions * (0.4 + Math.random() * 0.3)),
          likes: 80 + Math.floor(Math.random() * 260),
          comments: 5 + Math.floor(Math.random() * 45),
          shares: 2 + Math.floor(Math.random() * 22),
        },
      });
    }
  }

  console.log("Seeded demo account: demo@example.com / demo1234");
  console.log("Demo API key:", DEMO_KEY);
  console.log("Admin account: angch@tertiaryinfotech.com (Dr. Alfred Ang) — profile 'tertiarycourses' with LinkedIn (angchewhoe) + Facebook (TertiaryCourses)");
  console.log("Admin API key:", ALFRED_KEY);
}

main().finally(() => db.$disconnect());
