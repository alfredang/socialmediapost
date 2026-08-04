import { notFound } from "next/navigation";
import { requireSessionAccount } from "@/lib/session";
import { appBaseUrl } from "@/lib/base-url";
import { headers } from "next/headers";
import { settingsStatus } from "@/lib/settings";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Instance Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const account = await requireSessionAccount();
  // Instance settings are admin-only. 404 rather than a "forbidden" page so the
  // area is not advertised to ordinary users.
  if (account.role !== "admin") notFound();

  // headers() is async in Next 16 — synchronous access was removed.
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host") ?? "localhost:3000"}`;
  const base = appBaseUrl(origin);

  return (
    <SettingsClient
      settings={await settingsStatus()}
      adminEmail={account.email}
      redirectUri={`${base}/api/auth/google/callback`}
      jsOrigin={base}
      baseUrlConfigured={Boolean(process.env.PUBLIC_BASE_URL)}
    />
  );
}
