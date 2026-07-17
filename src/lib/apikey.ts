import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { getPlan } from "./plans";

export function generateApiKey(): { key: string; hashed: string; prefix: string } {
  const key = "up_" + randomBytes(24).toString("hex");
  return { key, hashed: hashKey(key), prefix: key.slice(0, 10) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export type ApiAuth = {
  accountId: string;
  apiKeyId: string;
};

// Authenticates `Authorization: Apikey <key>` and logs the request.
// Returns a NextResponse error when auth/quota fails.
export async function authenticateApiKey(
  req: NextRequest
): Promise<ApiAuth | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Apikey\s+(.+)$/i);
  if (!match) {
    return NextResponse.json(
      { success: false, error: "Missing or malformed Authorization header. Use: Authorization: Apikey <your-api-key>" },
      { status: 401 }
    );
  }
  const apiKey = await db.apiKey.findUnique({ where: { hashedKey: hashKey(match[1].trim()) } });
  if (!apiKey || apiKey.status !== "active") {
    return NextResponse.json({ success: false, error: "Invalid or revoked API key" }, { status: 401 });
  }
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return { accountId: apiKey.accountId, apiKeyId: apiKey.id };
}

export async function logApiRequest(accountId: string, req: NextRequest, status: number) {
  const url = new URL(req.url);
  await db.apiRequestLog.create({
    data: { accountId, endpoint: url.pathname, method: req.method, status },
  });
}

export async function checkUploadQuota(accountId: string): Promise<NextResponse | null> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 401 });
  const plan = getPlan(account.plan);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await db.post.count({
    where: { profile: { accountId }, createdAt: { gte: monthStart }, status: { not: "draft" } },
  });
  if (used >= plan.uploadsPerMonth) {
    return NextResponse.json(
      {
        success: false,
        error: `Monthly upload quota reached (${plan.uploadsPerMonth} uploads on the ${plan.name} plan). Upgrade your plan to continue.`,
      },
      { status: 429 }
    );
  }
  return null;
}
