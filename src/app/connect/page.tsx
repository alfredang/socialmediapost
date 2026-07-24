import { Suspense } from "react";
import { verifyProfileJwt } from "@/lib/session";
import { db } from "@/lib/db";
import { LogoMark } from "@/components/Logo";
import { ConnectClient } from "./connect-client";

export const metadata = { title: "Connect your accounts" };
export const dynamic = "force-dynamic";

// Whitelabel connect page: end users of an agency/SaaS land here via a JWT link
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const payload = token ? await verifyProfileJwt(token) : null;

  // Which platforms this profile has already OAuth-connected, so the page shows
  // real state rather than only what happened in this browser tab.
  const profileRow = payload
    ? await db.profile.findUnique({
        where: { accountId_name: { accountId: payload.accountId, name: payload.profile } },
        include: { socialAccounts: { select: { platform: true, status: true } } },
      })
    : null;
  const connected =
    profileRow?.socialAccounts.filter((a) => a.status === "connected").map((a) => a.platform) ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      <LogoMark size={48} />
      <div className="card mt-6 w-full max-w-md p-8 text-center">
        {!payload ? (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Link expired</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This connect link is invalid or has expired. Ask the sender for a fresh link.
            </p>
          </>
        ) : (
          <Suspense>
            <ConnectClient token={token!} profile={payload.profile} connected={connected} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
