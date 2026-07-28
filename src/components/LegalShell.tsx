import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

// Shared frame for public legal pages (/terms, /privacy).
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: {updated}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
        {children}
      </div>
    </section>
  );
}
