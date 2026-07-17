import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { PipelinesClient } from "./pipelines-client";

export const metadata = { title: "Pipelines" };
export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const account = (await getSessionAccount())!;
  const [pipelines, profiles] = await Promise.all([
    db.pipeline.findMany({
      where: { profile: { accountId: account.id } },
      include: { items: { orderBy: { order: "asc" } }, profile: true },
      orderBy: { createdAt: "desc" },
    }),
    db.profile.findMany({
      where: { accountId: account.id },
      include: { socialAccounts: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <PipelinesClient
      profiles={profiles.map((p) => ({
        id: p.id,
        name: p.name,
        platforms: p.socialAccounts.map((a) => a.platform),
      }))}
      pipelines={pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        profile: p.profile.name,
        platforms: JSON.parse(p.platforms) as string[],
        activeDays: JSON.parse(p.activeDays) as string[],
        slotTimes: JSON.parse(p.slotTimes) as string[],
        timezone: p.timezone,
        status: p.status,
        loop: p.loop,
        lastRunAt: p.lastRunAt?.toISOString() ?? null,
        items: p.items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          status: i.status,
          publishedAt: i.publishedAt?.toISOString() ?? null,
        })),
      }))}
    />
  );
}
