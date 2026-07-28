import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { UploadClient } from "./upload-client";

export const metadata = { title: "Upload" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const account = await requireSessionAccount();
  const profiles = await db.profile.findMany({
    where: { accountId: account.id },
    include: { socialAccounts: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <UploadClient
      profiles={profiles.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.socialAccounts.map((a) => ({
          platform: a.platform,
          handle: a.handle,
          status: a.status,
        })),
      }))}
    />
  );
}
