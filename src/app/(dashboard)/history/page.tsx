import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { HistoryClient } from "./history-client";

export const metadata = { title: "Upload History" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const account = (await getSessionAccount())!;
  const targets = await db.postTarget.findMany({
    where: { post: { profile: { accountId: account.id } } },
    include: {
      post: { include: { profile: true } },
      metrics: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { id: "desc" },
    take: 200,
  });

  return (
    <HistoryClient
      rows={targets.map((t) => {
        const media = JSON.parse(t.post.mediaFiles) as { name: string; size: number; mime: string }[];
        return {
          id: t.id,
          postId: t.post.id,
          platform: t.platform,
          profile: t.post.profile.name,
          status: t.post.status === "draft" ? "draft" : t.status,
          when: (t.publishedAt ?? t.post.scheduledAt ?? t.post.createdAt).toISOString(),
          title: t.adaptedTitle || t.post.title,
          body: t.adaptedBody || t.post.description,
          mediaType: t.post.type,
          mediaSize: media[0]?.size ?? 0,
          url: t.externalUrl,
          error: t.error,
          metrics: t.metrics[0]
            ? { views: t.metrics[0].views, likes: t.metrics[0].likes, comments: t.metrics[0].comments, shares: t.metrics[0].shares }
            : null,
        };
      })}
    />
  );
}
