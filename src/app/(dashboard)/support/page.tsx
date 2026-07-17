import Link from "next/link";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Support</p>
      <h1 className="mt-2 text-4xl font-extrabold text-slate-900 dark:text-white">How can we help?</h1>
      <p className="mt-3 text-slate-500 dark:text-slate-400">
        We&apos;re here to help you with any questions or issues. Chat with our AI assistant, reach
        out via email, or check our docs.
      </p>

      <div className="mt-8 space-y-4 text-left">
        <section className="card p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /></svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chat with our AI assistant</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Get instant answers about the API, integrations, and features. Available 24/7 in our docs.
              </p>
              <Link href="/docs" className="btn-primary mt-3">💬 Open the docs &amp; AI chat</Link>
              <p className="mt-2 text-xs text-slate-400">⚡ Instant answers, no waiting</p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact us by email</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                For more complex issues, drop us a line and we&apos;ll get back to you.
              </p>
              <a href="mailto:support@socialpost.local" className="btn-secondary mt-3">✉ support@socialpost.local</a>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /></svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Browse the documentation</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Endpoints, parameters, SDKs, integrations and platform requirements.
              </p>
              <Link href="/docs" className="btn-secondary mt-3">📚 Open documentation</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
