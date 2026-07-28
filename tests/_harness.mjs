// Shared test harness for the SocialPost functional suite.
//
// Black-box HTTP only (no DB coupling). Each test file self-provisions a
// throwaway account + profile + API key via setup() and removes it via
// teardown(), so the suite depends on nothing in the database and never
// touches real accounts. Nothing here publishes to a real platform.
//
// Requires the dev server running:  npm run dev   (or npm start)
// Node 18+ (global fetch / FormData / Blob).

import assert from "node:assert";

export const BASE = process.argv[2] ?? process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000";

// ── tiny check runner ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

export function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

export function section(title) {
  console.log(`\n── ${title} ──`);
}

// Returns process exit code and prints a per-file summary.
export function done(file) {
  console.log(`\n${file}: ${passed} passed, ${failed} failed`);
  return failed ? 1 : 0;
}

export { assert };

// ── HTTP helper with a minimal cookie jar ──────────────────────────────────────
// opts: { json, form (FormData), key (API key), cookie, redirect }
export async function req(method, path, opts = {}) {
  const headers = {};
  let body;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form; // fetch sets multipart boundary
  }
  if (opts.key) headers["authorization"] = `Apikey ${opts.key}`;
  if (opts.cookie) headers["cookie"] = opts.cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body,
    redirect: opts.redirect ?? "follow",
  });

  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  const ct = res.headers.get("content-type") ?? "";
  let data = null;
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => "");

  return {
    status: res.status,
    data,
    location: res.headers.get("location"),
    // The sp_session cookie value, if this response set one.
    sessionCookie: extractSession(setCookie),
  };
}

function extractSession(setCookieArr) {
  for (const c of setCookieArr ?? []) {
    const m = /(?:^|;\s*)?(sp_session=[^;]+)/.exec(c) ?? /^(sp_session=[^;]+)/.exec(c);
    if (m) return m[1];
    if (c && c.startsWith("sp_session=")) return c.split(";")[0];
  }
  return null;
}

// ── provisioning ───────────────────────────────────────────────────────────────
let seq = 0;
export function uniqueEmail(tag) {
  seq++;
  return `qa-${tag}-${Date.now()}-${seq}@example.test`;
}

// Registers a throwaway account, creates a profile + API key. Returns context.
export async function setup(tag = "test") {
  const email = uniqueEmail(tag);
  const reg = await req("POST", "/api/auth/register", { json: { email, password: "qapass1234" } });
  if (reg.status !== 200 || !reg.sessionCookie) {
    throw new Error(`setup: register failed (status ${reg.status}). Is the server running at ${BASE}?`);
  }
  const cookie = reg.sessionCookie;
  const prof = await req("POST", "/api/internal/profiles", { json: { name: "qaprofile" }, cookie });
  const profileId = prof.data?.profile?.id ?? "";
  const key = await req("POST", "/api/internal/keys", { json: { label: "QA" }, cookie });
  const apiKey = key.data?.key ?? "";
  return { email, cookie, profileId, apiKey };
}

export async function teardown(ctx) {
  if (ctx?.cookie) await req("DELETE", "/api/internal/account", { cookie: ctx.cookie }).catch(() => {});
}

// Small helpers for building multipart bodies without touching disk.
export function tinyForm(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
export function blobFile(name, mime, bytes = "QAFILEDATA") {
  return { blob: new Blob([bytes], { type: mime }), name };
}
