import Link from "next/link";

// SocialPost brand mark: paper-plane burst in an emerald→cyan gradient tile.
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-500 shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4Z" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
        Social<span className="text-emerald-600 dark:text-emerald-400">Post</span>
      </span>
    </Link>
  );
}
