// Auth flows — register, login, OTP (mail-required), Google (config-gated),
// magic link. No posting. Run: node tests/auth.test.mjs [baseUrl]

import { req, check, section, done, uniqueEmail, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — auth");

const email = uniqueEmail("auth");
let cookie = null;

section("register / login");
{
  const r = await req("POST", "/api/auth/register", { json: { email, password: "qapass1234" } });
  check("register new account -> 200", () => assert.strictEqual(r.status, 200));
  check("register sets session cookie", () => assert.ok(r.sessionCookie));
  cookie = r.sessionCookie;

  const dup = await req("POST", "/api/auth/register", { json: { email, password: "qapass1234" } });
  check("duplicate register -> 409", () => assert.strictEqual(dup.status, 409));

  const bad = await req("POST", "/api/auth/login", { json: { email, password: "wrong" } });
  check("wrong password -> 401", () => assert.strictEqual(bad.status, 401));

  const ok = await req("POST", "/api/auth/login", { json: { email, password: "qapass1234" } });
  check("correct login -> 200", () => assert.strictEqual(ok.status, 200));
}

section("OTP requires configured mail, never leaks the code");
{
  const r = await req("POST", "/api/auth/request-otp", { json: { email } });
  // 200 (mail configured) or 503 (not configured) — but NEVER a code in the body.
  check("request-otp -> 200 or 503 (never 500)", () => assert.ok([200, 503].includes(r.status)));
  check("response never contains dev_code / dev_magic_link", () =>
    assert.ok(!("dev_code" in (r.data ?? {})) && !("dev_magic_link" in (r.data ?? {}))));
  if (r.status === 503) {
    check("503 explains mail isn't configured", () => assert.match(r.data.error, /email/i));
  }

  const bad = await req("POST", "/api/auth/verify-otp", { json: { email, code: "000000" } });
  check("verify wrong code -> 401", () => assert.strictEqual(bad.status, 401));
}

section("Google button is config-gated (no demo fallback)");
{
  const r = await req("GET", "/api/auth/google", { redirect: "manual" });
  check("google -> redirect (3xx)", () => assert.ok(r.status >= 300 && r.status < 400));
  // Either real Google OAuth (configured) or back to /login?error=google-not-configured.
  check("redirects to Google OR google-not-configured (never signs in)", () =>
    assert.ok(/accounts\.google\.com/.test(r.location) || /google-not-configured/.test(r.location)));
}

section("magic link — invalid token rejected");
{
  const r = await req("GET", "/api/auth/magic?token=bogus", { redirect: "manual" });
  check("bad magic token -> redirect to /login with error", () =>
    assert.ok(r.status >= 300 && r.status < 400 && /\/login\?error=/.test(r.location)));
}

await teardown({ cookie });
process.exit(done("auth.test.mjs"));
