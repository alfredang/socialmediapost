import Link from "next/link";
import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = { title: "Connected Apps" };
export const dynamic = "force-dynamic";

export default async function ConnectedAppsPage() {
  const account = await requireSessionAccount();
  const apps = await db.connectedApp.findMany({ where: { accountId: account.id } });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Connected Apps</h1>
        <Link href="/api-keys" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600">← Back to API Keys</Link>
      </div>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        External apps connected to your SocialPost account via OAuth (claude.ai Custom Connectors,
        ChatGPT, GitHub Copilot, etc.). Revoke any to immediately cut off access — they&apos;ll need
        re-authorization to come back.
      </p>

      <div className="card mt-6 p-10">
        {apps.length === 0 ? (
          <div className="text-center">
            <svg className="mx-auto text-slate-300 dark:text-slate-600" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22v-5M9 8V2M15 8V2M6 8h12v4a6 6 0 0 1-12 0V8Z" />
            </svg>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">No connected apps yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Add SocialPost as a Custom Connector inside claude.ai, GitHub Copilot or another
              MCP-compatible AI agent — you&apos;ll see it listed here once authorized. See the{" "}
              <Link href="/docs#integrations" className="text-emerald-600 dark:text-emerald-400 underline">integrations guide</Link>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {apps.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-slate-900 dark:text-white">{a.name}</span>
                <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
