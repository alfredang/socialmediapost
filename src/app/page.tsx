import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORMS } from "@/lib/platforms";
import { getSessionAccountId } from "@/lib/session";
import { CurlTabs } from "./landing-curl-tabs";

export const metadata = {
  title: "SocialPost — One API to post on every social platform",
  description:
    "Upload videos, photos and text posts to TikTok, Instagram, YouTube, LinkedIn, X and 17 more platforms with one API call. Scheduling, analytics, whitelabel and auto-adaptation included.",
};

const STATS = [
  ["22", "platforms"],
  ["3", "endpoints to learn"],
  ["<5 min", "to first post"],
  ["1", "API key"],
];

const BENTO = [
  {
    icon: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
    title: "One call, every network",
    body: "POST /api/upload once — video, photos, text or LinkedIn documents fan out to 22 platforms simultaneously, with per-platform results in the response.",
    wide: true,
  },
  {
    icon: "M12 3v3m0 12v3m9-9h-3M6 12H3m13.4-6.4-2.1 2.1M8.7 15.3l-2.1 2.1m0-10.8 2.1 2.1m6.6 6.6 2.1 2.1",
    title: "Auto-adapts everything",
    body: "150 chars on TikTok, 280 weighted on X, hashtags → first comment on Instagram. Grapheme-aware, so emoji count correctly. 🚀",
  },
  {
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    title: "Queues, calendar & pipelines",
    body: "Smart posting slots per profile, drag-through calendar, and recurring content pipelines that drain a queue of posts hands-free.",
  },
  {
    icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
    title: "Analytics API",
    body: "Followers, reach, impressions and engagement per platform — dashboard charts, CSV export, and a clean JSON API.",
  },
  {
    icon: "M20 7h-9m9 10h-9M5 7h.01M5 17h.01",
    title: "Whitelabel-ready",
    body: "Profiles API + JWT connect-links: your customers link their accounts under your brand. You keep the relationship and the margin.",
    wide: true,
  },
];

export default async function LandingPage() {
  const signedIn = Boolean(await getSessionAccountId());

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo href="/" />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex" aria-label="Landing">
            <a href="#api" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">API</a>
            <a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Features</a>
            <a href="#platforms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Platforms</a>
            <a href="#integrations" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Integrations</a>
            <a href="#pricing" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link href="/users" className="btn-primary">Dashboard →</Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary hidden sm:inline-flex">Sign in</Link>
                <Link href="/login" className="btn-primary">Get free API key</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — terminal-forward, split layout */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 font-mono text-xs text-emerald-300">
                $ one API · 22 platforms
              </span>
              <h1 className="mt-6 text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
                Ship your content{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  everywhere
                </span>{" "}
                with one request
              </h1>
              <p className="mt-5 max-w-lg text-lg text-slate-300">
                SocialPost is the publishing backend for developers, agencies and creators: post,
                schedule, automate and measure across every social network — without touching 22
                dashboards.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary px-6 py-3 text-base">Get your free API key →</Link>
                <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition-colors">
                  Read the docs
                </Link>
              </div>
              <p className="mt-3 font-mono text-xs text-slate-400">free plan · 10 uploads/mo · no credit card</p>
              <dl className="mt-10 grid grid-cols-4 gap-4 border-t border-white/10 pt-6">
                {STATS.map(([v, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-mono text-2xl font-bold text-emerald-400">{v}</dd>
                    <dd className="text-xs text-slate-400">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div id="api">
              <CurlTabs />
            </div>
          </div>
        </section>

        {/* Bento features */}
        <section id="features" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">// features</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              Everything a publishing stack needs
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENTO.map((f) => (
                <div key={f.title} className={`card p-6 ${f.wide ? "lg:col-span-2" : ""}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.body}</p>
                </div>
              ))}
              <div className="card flex flex-col justify-center p-6 bg-gradient-to-br from-emerald-500 to-cyan-500 border-0">
                <h3 className="text-lg font-bold text-slate-950">AI copy assistant</h3>
                <p className="mt-1.5 text-sm text-slate-900/80">
                  Generate captions, hashtags and per-platform rewrites right in the composer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section id="platforms" className="border-y border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">// platforms</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">22 networks. One integration.</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <span key={p.id} className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <PlatformIcon platform={p.id} size={16} /> {p.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">// integrations</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Works with your stack — and your AI</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { title: "Python SDK", body: "pip-installable client for scripts, bots and backends.", badge: "sdks/python" },
                { title: "Node.js SDK", body: "Zero-dependency npm package, Node ≥18.", badge: "sdks/node" },
                { title: "n8n node", body: "Drag SocialPost steps into any workflow.", badge: "sdks/n8n" },
                { title: "VS Code extension", body: "Post a selection or file without leaving the editor.", badge: "sdks/vscode" },
                { title: "Copilot & Claude (MCP)", body: "AI agents post for you via the MCP server.", badge: "sdks/mcp" },
              ].map((c) => (
                <Link key={c.title} href="/docs#integrations" className="card p-5 transition-transform hover:-translate-y-0.5">
                  <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">{c.badge}</span>
                  <h3 className="mt-3 font-bold text-slate-900 dark:text-white">{c.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{c.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="border-t border-slate-100 dark:border-white/10 py-20">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">// pricing</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Start free. Scale when you do.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Free", "$0", "1 profile · 10 uploads/mo"],
                ["Basic", "$15/mo", "5 profiles · 100 uploads/mo"],
                ["Professional", "$30/mo", "25 profiles · 500 uploads/mo · team"],
              ].map(([name, price, blurb]) => (
                <div key={name} className={`card p-6 ${name === "Professional" ? "border-emerald-500/60 border-2" : ""}`}>
                  <p className="font-mono text-xs uppercase tracking-widest text-slate-400">{name}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{price}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{blurb}</p>
                </div>
              ))}
            </div>
            <Link href="/login" className="btn-primary mt-8 px-8 py-3 text-base">Create your free account →</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
