import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/internal-auth";

// GET — render a simple HTML invoice (printable / save as PDF)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, accountId: auth },
    include: { account: true },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const download = req.nextUrl.searchParams.get("download");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoice.number}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#0f172a}h1{color:#5b5bef}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}.total{font-size:1.3em;font-weight:800}.badge{background:#dcfce7;color:#15803d;padding:2px 10px;border-radius:99px;font-size:12px}</style>
${download ? "<script>window.onload=()=>window.print()</script>" : ""}</head><body>
<h1>SocialPost</h1><p>Invoice <strong>${invoice.number}</strong> · <span class="badge">${invoice.status}</span></p>
<p>Billed to: ${invoice.account.email}<br>Date: ${invoice.createdAt.toLocaleDateString("en-GB")}</p>
<table><tr><th>Description</th><th>Amount</th></tr>
<tr><td>SocialPost subscription (${invoice.account.plan}, ${invoice.account.planInterval})</td><td>$${invoice.total.toFixed(2)}</td></tr>
<tr><td class="total">Total</td><td class="total">$${invoice.total.toFixed(2)} USD</td></tr></table>
<p style="margin-top:32px;color:#64748b;font-size:13px">SocialPost · Demo invoice — simulated billing.</p>
</body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html" } });
}
