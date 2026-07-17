import { getSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const account = (await getSessionAccount())!;
  const posts = await db.post.findMany({
    where: {
      profile: { accountId: account.id },
      status: { in: ["scheduled", "published", "partial", "failed"] },
    },
    include: { targets: true, profile: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  return (
    <CalendarClient
      weekStart={account.calendarWeekStart}
      events={posts.map((p) => ({
        id: p.id,
        title: p.title || p.description.slice(0, 40) || "(untitled)",
        date: (p.scheduledAt ?? p.createdAt).toISOString(),
        status: p.status,
        profile: p.profile.name,
        platforms: p.targets.map((t) => t.platform),
      }))}
      profiles={[...new Set(posts.map((p) => p.profile.name))]}
    />
  );
}
