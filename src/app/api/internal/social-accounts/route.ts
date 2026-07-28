import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";
import { fetchPageDirect } from "@/lib/facebook";

// Accounts are only created via the real OAuth flows (/api/auth/<platform>).

// PATCH — fix a needs_reauth account, or { id, pageId } to finish a Facebook
// connection by picking which managed Page to publish to.
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const account = await db.socialAccount.findFirst({
    where: { id: body.id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (body.pageId) {
    if (account.platform !== "facebook" || !account.meta) {
      return NextResponse.json({ success: false, error: "Not a Facebook connection" }, { status: 400 });
    }
    const meta = JSON.parse(account.meta) as {
      userToken?: string;
      pages?: { id: string; name: string; access_token: string }[];
    };
    let page = meta.pages?.find((p) => p.id === body.pageId);
    if (!page && meta.userToken) {
      // /me/accounts came back empty for this account — resolve the Page
      // directly by ID with the stored user token.
      try {
        page = await fetchPageDirect(meta.userToken, String(body.pageId).trim());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not access that Page";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    }
    if (!page) return NextResponse.json({ success: false, error: "Page not found" }, { status: 404 });
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        handle: page.name,
        displayName: page.name,
        externalUserId: page.id,
        accessToken: page.access_token,
        status: "connected",
      },
    });
    return NextResponse.json({ success: true });
  }

  // A needs_reauth account cannot be "fixed" by flipping the flag: the stored
  // token is expired or revoked, so marking it connected would only make the
  // UI lie until the next publish failed. Reconnecting via OAuth is the fix.
  return NextResponse.json(
    {
      success: false,
      error: `Reconnect this ${account.platform} account to get a fresh token — its previous authorization is no longer valid.`,
      reconnect: true,
      platform: account.platform,
    },
    { status: 409 }
  );
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  const account = await db.socialAccount.findFirst({
    where: { id: id ?? "", profile: { accountId: auth } },
  });
  if (!account) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.socialAccount.delete({ where: { id: account.id } });
  return NextResponse.json({ success: true });
}
