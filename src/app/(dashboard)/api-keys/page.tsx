import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { ApiKeysClient } from "./api-keys-client";

export const metadata = { title: "API Keys" };
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const account = (await getSessionAccount())!;
  const plan = getPlan(account.plan);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [keys, apiCalls, ffmpegAgg, ffmpegCount] = await Promise.all([
    db.apiKey.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
    db.apiRequestLog.count({ where: { accountId: account.id, createdAt: { gte: monthStart } } }),
    db.ffmpegJob.aggregate({
      where: { accountId: account.id, createdAt: { gte: monthStart } },
      _sum: { minutes: true },
    }),
    db.ffmpegJob.count({ where: { accountId: account.id, createdAt: { gte: monthStart } } }),
  ]);

  return (
    <ApiKeysClient
      plan={{ id: plan.id, name: plan.name, ffmpegMinutes: plan.ffmpegMinutes, uploads: plan.uploadsPerMonth }}
      keys={keys.map((k) => ({
        id: k.id,
        label: k.label,
        prefix: k.prefix,
        status: k.status,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      }))}
      usage={{
        apiCalls,
        ffmpegUsed: ffmpegAgg._sum.minutes ?? 0,
        ffmpegRequests: ffmpegCount,
      }}
    />
  );
}
