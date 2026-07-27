import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { CommentsClient } from "./comments-client";

export const metadata = { title: "Comments" };
export const dynamic = "force-dynamic";

// Lists published posts on the platforms whose comments we can read/reply to
// (Facebook + Instagram). Comments themselves are fetched live, on demand, by
// the client — the server render only enumerates which posts are eligible.
export default async function CommentsPage() {
  const account = await requireSessionAccount();
  const targets = await db.postTarget.findMany({
    where: {
      status: "published",
      platform: { in: ["facebook", "instagram"] },
      externalId: { not: null },
      post: { profile: { accountId: account.id } },
    },
    include: { post: { include: { profile: true } } },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });

  return (
    <CommentsClient
      posts={targets.map((t) => ({
        requestId: t.post.requestId,
        platform: t.platform,
        profile: t.post.profile.name,
        title: t.adaptedTitle || t.post.title || t.post.description,
        url: t.externalUrl,
        when: (t.publishedAt ?? t.post.createdAt).toISOString(),
      }))}
    />
  );
}
