import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getQueueConfig, computeSlots } from "@/lib/queue";
import { QueueClient } from "./queue-client";

export const metadata = { title: "Queue Settings" };
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const account = (await getSessionAccount())!;
  const profiles = await db.profile.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });
  const first = profiles[0];
  const config = first ? await getQueueConfig(first.id) : null;
  const slots = config ? computeSlots(config, new Date(), 10) : [];

  return (
    <QueueClient
      profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
      initial={
        first && config
          ? { profileId: first.id, config, slots: slots.map((d) => d.toISOString()) }
          : null
      }
    />
  );
}
