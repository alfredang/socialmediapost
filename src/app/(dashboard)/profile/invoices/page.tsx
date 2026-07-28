import Link from "next/link";
import { requireSessionAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const account = await requireSessionAccount();
  const invoices = await db.invoice.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/profile" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600">← Back to profile</Link>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">Invoices</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Legally valid invoices issued for your SocialPost subscription. Click <strong>View</strong> to
        open the invoice or <strong>PDF</strong> for the download.
      </p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Number</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No invoices yet — they appear when you switch to a paid plan.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-5 py-3 font-mono text-slate-900 dark:text-white">{inv.number}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{inv.createdAt.toLocaleDateString("en-GB")}</td>
                <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">${inv.total.toFixed(2)}</td>
                <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex gap-2">
                    <a href={`/api/internal/invoices/${inv.id}`} target="_blank" className="btn-secondary px-3 py-1 text-xs">↗ View</a>
                    <a href={`/api/internal/invoices/${inv.id}?download=1`} className="btn-primary px-3 py-1 text-xs">📄 PDF</a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        These are the invoices issued by our billing system. For payment method, billing address or
        subscription changes, use the <Link href="/pricing" className="text-emerald-600 dark:text-emerald-400 underline">plan management page</Link>.
      </p>
    </div>
  );
}
