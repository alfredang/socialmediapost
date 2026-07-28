// Public API: key auth, /me, whitelabel JWT, analytics, per-platform metrics,
// public reads, retired connect endpoint. No posting.
// Run: node tests/public-api.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — public API");
const ctx = await setup("papi");
const { cookie, apiKey } = ctx;

section("key auth");
{
  const me = await req("GET", "/api/uploadposts/me", { key: apiKey });
  check("GET /me with key -> 200", () => assert.strictEqual(me.status, 200));
  check("/me reports plan + limits", () => assert.ok(me.data.plan && me.data.limits));
  const bad = await req("GET", "/api/uploadposts/me", { key: "up_bogus" });
  check("invalid key -> 401", () => assert.strictEqual(bad.status, 401));
  const none = await req("GET", "/api/uploadposts/me");
  check("missing key -> 401", () => assert.strictEqual(none.status, 401));
}

section("whitelabel users + connect JWT");
{
  const list = await req("GET", "/api/uploadposts/users", { key: apiKey });
  check("list profiles -> 200", () => assert.strictEqual(list.status, 200));
  const gen = await req("POST", "/api/uploadposts/users/generate-jwt", { json: { username: "qaprofile" }, key: apiKey });
  check("generate connect JWT -> 200", () => assert.strictEqual(gen.status, 200));
  const token = gen.data.access_token;
  const val = await req("GET", `/api/uploadposts/users/validate-jwt?token=${encodeURIComponent(token)}`);
  check("validate JWT -> 200 valid", () => assert.ok(val.status === 200 && val.data.valid));
  const bad = await req("GET", "/api/uploadposts/users/validate-jwt?token=bogus");
  check("validate bogus JWT -> 401", () => assert.strictEqual(bad.status, 401));
}

section("retired handle-connect endpoint");
{
  const r = await req("POST", "/api/connect", { json: { token: "x", platform: "instagram", handle: "y" } });
  check("POST /api/connect -> 410 Gone", () => assert.strictEqual(r.status, 410));
}

section("per-platform metrics (public)");
{
  const pm = await req("GET", "/api/uploadposts/platform-metrics");
  check("platform-metrics -> 200", () => assert.strictEqual(pm.status, 200));
  const P = pm.data.platforms;
  check("Instagram reports views, NOT impressions", () =>
    assert.ok(P.instagram.metrics.includes("views") && !P.instagram.metrics.includes("impressions")));
  check("LinkedIn only likes/comments", () =>
    assert.deepStrictEqual([...P.linkedin.metrics].sort(), ["comments", "likes"]));
  check("platforms with no collector report []", () => assert.deepStrictEqual(P.youtube.metrics, []));
}

section("analytics reads");
{
  const an = await req("GET", "/api/analytics/qaprofile", { key: apiKey });
  check("analytics for profile -> 200 (empty ok)", () => assert.strictEqual(an.status, 200));
  const miss = await req("GET", "/api/uploadposts/post-analytics/nope", { key: apiKey });
  check("post-analytics missing -> 404", () => assert.strictEqual(miss.status, 404));
  const sync = await req("POST", "/api/internal/analytics/sync", { cookie });
  check("internal sync -> 200 (0 accounts on fresh profile)", () =>
    assert.ok(sync.status === 200 && sync.data.accounts_checked === 0));
}

section("public reads");
{
  const st = await req("GET", "/api/uploadposts/status?request_id=doesnotexist", { key: apiKey });
  check("status for missing id -> 404", () => assert.strictEqual(st.status, 404));
  const hist = await req("GET", "/api/uploadposts/history?limit=5", { key: apiKey });
  check("history -> 200", () => assert.strictEqual(hist.status, 200));
  const sched = await req("GET", "/api/uploadposts/schedule", { key: apiKey });
  check("schedule -> 200", () => assert.strictEqual(sched.status, 200));
  const media = await req("GET", "/api/uploadposts/media?user=qaprofile", { key: apiKey });
  check("media -> 200", () => assert.strictEqual(media.status, 200));
  // No Facebook connected on a fresh profile → 404; non-facebook platform → 400.
  const pagesNone = await req("GET", "/api/uploadposts/pages?user=qaprofile", { key: apiKey });
  check("pages with no FB account -> 404", () => assert.strictEqual(pagesNone.status, 404));
  const pagesTt = await req("GET", "/api/uploadposts/pages?user=qaprofile&platform=tiktok", { key: apiKey });
  check("pages for non-facebook platform -> 400", () => assert.strictEqual(pagesTt.status, 400));
  const cmMiss = await req("GET", "/api/uploadposts/comments?request_id=nope", { key: apiKey });
  check("comments for missing post -> 404", () => assert.strictEqual(cmMiss.status, 404));
  const cmTt = await req("GET", "/api/uploadposts/comments?request_id=nope&platform=tiktok", { key: apiKey });
  check("comments for unsupported platform -> 400", () => assert.strictEqual(cmTt.status, 400));
  // instagram is supported → the platform is accepted and we get 404 (post not found), not 400.
  const cmIg = await req("GET", "/api/uploadposts/comments?request_id=nope&platform=instagram", { key: apiKey });
  check("comments for instagram (missing post) -> 404", () => assert.strictEqual(cmIg.status, 404));
}

await teardown(ctx);
process.exit(done("public-api.test.mjs"));
