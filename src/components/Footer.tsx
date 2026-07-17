import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/users", label: "Dashboard" },
      { href: "/users", label: "Manage Profiles" },
      { href: "/pricing", label: "Pricing" },
      { href: "/api-keys", label: "Billing & Usage" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "API & Integrations" },
      { href: "/docs", label: "Documentation" },
      { href: "/docs#sdks", label: "SDKs" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Help Center" },
      { href: "/support", label: "Leave a review ⭐" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-slate-900 dark:text-white">
            Social<span className="text-emerald-600 dark:text-emerald-400">Post</span>
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Your API solution for all social media platforms. Simplifying content
            management for developers and creators.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-900 py-4 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} SocialPost. All rights reserved.</p>
        <p className="powered-by mt-1">
          Powered by{" "}
          <a href="https://www.tertiaryinfotech.com/" target="_blank" rel="noopener" className="hover:text-emerald-500 underline">
            Tertiary Infotech Academy Pte Ltd
          </a>
        </p>
      </div>
    </footer>
  );
}
