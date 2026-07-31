import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { monthlyUsage } from "@/lib/usage";
import { ApiKeysClient } from "./api-keys-client";

export const metadata = { title: "API Keys" };
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const account = await requireSessionAccount();
  const plan = getPlan(account.plan);

  const [keys, usage] = await Promise.all([
    db.apiKey.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
    monthlyUsage(account.id),
  ]);

  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://your-domain.com";

  return (
    <ApiKeysClient
      baseUrl={baseUrl}
      plan={{ id: plan.id, name: plan.name, ffmpegMinutes: plan.ffmpegMinutes, uploads: plan.uploadsPerMonth }}
      keys={keys.map((k) => ({
        id: k.id,
        label: k.label,
        prefix: k.prefix,
        status: k.status,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      }))}
      usage={usage}
    />
  );
}
