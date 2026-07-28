"use client";

// SocialPost v2 shell: fixed left sidebar (desktop) + top bar with drawer (mobile).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo, LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/users", label: "Users", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/upload", label: "Upload", icon: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" },
  { href: "/pipelines", label: "Pipelines", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { href: "/calendar", label: "Calendar", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { href: "/history", label: "History", icon: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" },
  { href: "/comments", label: "Comments", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/analytics", label: "Analytics", icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3" },
  { href: "/api-keys", label: "API Keys", icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" },
  { href: "/pricing", label: "Pricing", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { href: "/docs", label: "Docs", icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" },
];

const MENU = [
  { href: "/profile", label: "My Profile" },
  { href: "/profile/invoices", label: "Billing & Invoices" },
  { href: "/calendar/queue", label: "Queue Settings" },
  { href: "/connected-apps", label: "Connected Apps" },
  { href: "/team", label: "Team Management" },
  { href: "/support", label: "Support" },
];

interface Notification {
  id: string;
  kind: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-emerald-500" />}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Navbar({ email, plan }: { email: string; plan: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/internal/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setNotifications(d.notifications);
          setUnread(d.unread);
        }
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function openBell() {
    setBellOpen(!bellOpen);
    if (!bellOpen && unread > 0) {
      await fetch("/api/internal/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const bottomControls = (
    <div className="border-t border-slate-200 dark:border-white/10 p-3 space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="relative" ref={bellRef}>
          <button
            onClick={openBell}
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">
                {unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute bottom-11 left-0 z-50 w-80 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
              <div className="px-4 py-2.5 text-sm font-bold border-b border-slate-100 dark:border-white/10 text-slate-900 dark:text-white">Notifications</div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">No notifications yet</p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-2.5 px-4 py-2.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.kind === "success" ? "bg-emerald-500" : n.kind === "error" ? "bg-red-500" : "bg-cyan-500"}`} />
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <ThemeToggle />
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Account menu"
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-bold text-slate-950">
            {email.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{email}</span>
            <span className="block font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{plan}</span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute bottom-14 left-0 right-0 z-50 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border-t border-slate-100 dark:border-white/10 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/70 dark:backdrop-blur lg:flex">
        <div className="px-5 py-5">
          <Logo href="/users" />
        </div>
        <NavLinks pathname={pathname} />
        {bottomControls}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 backdrop-blur px-4 lg:hidden">
        <Logo href="/users" />
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-5">
              <LogoMark size={32} />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-slate-400 cursor-pointer">✕</button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            {bottomControls}
          </aside>
        </div>
      )}
    </>
  );
}
