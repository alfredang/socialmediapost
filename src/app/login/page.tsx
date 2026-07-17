"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

function LoginForm() {
  const params = useSearchParams();
  const [accepted, setAccepted] = useState(true);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Sign-in failed. Please try again." : null
  );
  const [busy, setBusy] = useState(false);

  async function sendLink() {
    if (!accepted) return setError("Please accept the Terms of Use and Privacy Policy first.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.success) return setError(data.error);
    setDevCode(data.dev_code ?? null);
    setDevLink(data.dev_magic_link ?? null);
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.success) return setError(data.error);
    window.location.href = "/users";
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.08) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-md">
          <LogoMark size={52} />
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">SocialPost</span>
      </div>

      <div className="card w-full max-w-md p-8">
        <h1 className="text-3xl font-extrabold text-center text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-2 text-center text-slate-500 dark:text-slate-400">
          Sign in to manage and publish your content across every platform.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            I accept the{" "}
            <Link href="/docs" className="text-emerald-600 dark:text-emerald-400 underline">Terms of Use</Link> and{" "}
            <Link href="/docs" className="text-emerald-600 dark:text-emerald-400 underline">Privacy Policy</Link>.
          </span>
        </label>

        <a
          href="/api/auth/google"
          onClick={(e) => { if (!accepted) { e.preventDefault(); setError("Please accept the Terms of Use and Privacy Policy first."); } }}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span>Sign in with Google</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
          </svg>
        </a>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-semibold tracking-widest text-slate-400">OR CONTINUE WITH EMAIL</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        {step === "email" ? (
          <>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
            />
            <button onClick={sendLink} disabled={busy || !email} className="btn-primary mt-4 w-full py-3">
              {busy ? "Sending…" : "Send magic link →"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              New here? Signing in creates your free account automatically.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We sent a 6-digit code and a magic link to <strong>{email}</strong>.
            </p>
            {devCode && (
              <p className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                Dev mode (no SMTP configured) — your code is <strong className="tracking-widest">{devCode}</strong>
                {devLink && (
                  <>
                    {" "}or use the <a className="underline" href={devLink}>magic link</a>.
                  </>
                )}
              </p>
            )}
            <label className="label mt-4" htmlFor="code">Enter code</label>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              className="input text-center text-xl tracking-[0.5em] font-bold"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button onClick={verify} disabled={busy || code.length !== 6} className="btn-primary mt-4 w-full py-3">
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button onClick={() => setStep("email")} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-emerald-600 cursor-pointer">
              ← Use a different email
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Demo account: <code className="font-mono">demo@example.com</code> (request a code)
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
