"use client";

import { useMemo, useState } from "react";
import type { SettingStatus } from "@/lib/settings";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200">
          {value}
        </code>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function SettingsClient({
  settings,
  adminEmail,
  redirectUri,
  jsOrigin,
  baseUrlConfigured,
}: {
  settings: SettingStatus[];
  adminEmail: string;
  redirectUri: string;
  jsOrigin: string;
  baseUrlConfigured: boolean;
}) {
  // Only edited fields are sent, so a blank secret input means "leave as-is"
  // rather than "clear it".
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rows, setRows] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [testTo, setTestTo] = useState(adminEmail);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const groups = useMemo(
    () => ({
      google: rows.filter((r) => r.group === "google"),
      smtp: rows.filter((r) => r.group === "smtp"),
      linkedin: rows.filter((r) => r.group === "linkedin"),
    }),
    [rows]
  );

  const dirty = Object.keys(edits).length > 0;

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/internal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: edits }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNotice({ kind: "error", text: data.error || `Could not save (HTTP ${res.status}).` });
      } else {
        setRows(data.settings);
        setEdits({});
        setNotice({ kind: "ok", text: "Settings saved. Sign-in uses them immediately." });
      }
    } catch {
      setNotice({ kind: "error", text: "Network error while saving." });
    }
    setSaving(false);
  }

  async function sendTest() {
    setTesting(true);
    setNotice(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/internal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-email", to: testTo }),
      });
      const data = await res.json();
      const result =
        res.ok && data.success
          ? { kind: "ok" as const, text: data.message }
          : { kind: "error" as const, text: data.error || "Test email failed." };
      // Shown BOTH inline (beside the button, where the user is looking) and in
      // the page-top banner. The banner alone is off-screen for anyone scrolled
      // down to the SMTP section, which reads as "nothing happened".
      setTestResult(result);
      setNotice(result);
    } catch {
      const result = { kind: "error" as const, text: "Network error while sending." };
      setTestResult(result);
      setNotice(result);
    }
    setTesting(false);
  }

  function field(row: SettingStatus) {
    const edited = edits[row.key];
    const shown = edited ?? row.value;
    return (
      <div key={row.key}>
        <label className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
          <span>{row.label}</span>
          {row.fromEnv ? (
            <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              set by environment
            </span>
          ) : row.configured ? (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              configured
            </span>
          ) : null}
        </label>
        <input
          className="input mt-1 w-full"
          type={row.secret ? "password" : "text"}
          value={row.fromEnv ? "" : shown}
          disabled={row.fromEnv}
          autoComplete="off"
          placeholder={
            row.fromEnv
              ? "Managed in your deployment environment"
              : row.secret && row.configured
                ? "•••••••• saved — type to replace"
                : row.placeholder
          }
          onChange={(e) => setEdits({ ...edits, [row.key]: e.target.value })}
        />
        {row.hint ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Instance settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure sign-in and email without redeploying. Values set in your deployment
          environment take precedence and are shown read-only here.
        </p>
      </header>

      {notice ? (
        <div
          className={
            notice.kind === "ok"
              ? "rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
              : "rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-300"
          }
        >
          {notice.text}
        </div>
      ) : null}

      {!baseUrlConfigured ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>PUBLIC_BASE_URL is not set.</strong> Behind a reverse proxy the app sees an
          internal address, so OAuth redirects and magic links can point at localhost. Set it in
          your deployment environment to <code>{jsOrigin}</code>.
        </div>
      ) : null}

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Google sign-in</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a Web application client in the Google Cloud console, then paste its
            credentials here.
          </p>
        </div>
        <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Register these two values in Google exactly as shown:
          </p>
          <CopyField label="Authorized JavaScript origin" value={jsOrigin} />
          <CopyField label="Authorized redirect URI" value={redirectUri} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{groups.google.map(field)}</div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">LinkedIn publishing</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Needed before a LinkedIn account can be connected on the Users page. Without it,
            posts fail with &ldquo;LinkedIn account isn&rsquo;t OAuth-connected&rdquo;.
          </p>
        </div>
        <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create an app at{" "}
            <a
              href="https://www.linkedin.com/developers/apps"
              target="_blank"
              rel="noopener"
              className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              linkedin.com/developers/apps
            </a>
            , add the <strong>Share on LinkedIn</strong> and <strong>Sign In with LinkedIn</strong>{" "}
            products, then register this redirect URL:
          </p>
          <CopyField label="Authorized redirect URL" value={`${jsOrigin}/api/auth/linkedin/callback`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{groups.linkedin.map(field)}</div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Email (SMTP)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Used for magic-link and one-time-code sign-in. Without it, email sign-in cannot
            deliver codes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{groups.smtp.map(field)}</div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Send a test email
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Save your changes first — the test uses the stored settings.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="input min-w-0 flex-1"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
            <button type="button" className="btn-secondary" onClick={sendTest} disabled={testing}>
              {testing ? "Sending…" : "Send test"}
            </button>
          </div>
          {testResult ? (
            <p
              className={
                testResult.kind === "ok"
                  ? "mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                  : "mt-2 text-sm font-medium text-red-700 dark:text-red-400"
              }
            >
              {testResult.kind === "ok" ? "✓ " : "✗ "}
              {testResult.text}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEdits({});
              setNotice(null);
            }}
          >
            Discard
          </button>
        ) : null}
        {/* Repeated beside the button: the page-top banner is off-screen for
            anyone scrolled down here, which reads as the save doing nothing. */}
        {!dirty && notice ? (
          <span
            className={
              notice.kind === "ok"
                ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                : "text-sm font-medium text-red-700 dark:text-red-400"
            }
          >
            {notice.kind === "ok" ? "✓ " : "✗ "}
            {notice.text}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Saved settings take effect immediately — no redeploy needed.
      </p>
    </div>
  );
}
