// Plan quota enforcement on the free plan (profiles, team seats, uploads/month,
// ffmpeg minutes). Fills the upload quota with SCHEDULED posts (never
// published), so nothing goes live. Run: node tests/quotas.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — plan quotas (free)");
const ctx = await setup("quota"); // free plan: 1 profile, 10 uploads/mo, 0 team, 30 ffmpeg min
const { cookie, apiKey, profileId } = ctx;

section("profile limit (free = 1)");
{
  // setup() already created the 1 allowed profile.
  const second = await req("POST", "/api/internal/profiles", { json: { name: "qaprofile2" }, cookie });
  check("2nd profile on free -> 429", () => assert.strictEqual(second.status, 429));
  check("error mentions the limit", () => assert.match(second.data.error, /limit/i));
}

section("team seats (free = 0)");
{
  const inv = await req("POST", "/api/internal/team", { json: { email: "mate@example.com", role: "member" }, cookie });
  check("invite on free -> 403", () => assert.strictEqual(inv.status, 403));
}

section("ffmpeg quota reported for the plan");
{
  const usage = await req("GET", "/api/uploadposts/ffmpeg/usage", { key: apiKey });
  check("usage -> 200", () => assert.strictEqual(usage.status, 200));
  check("free plan reports 30 monthly ffmpeg minutes", () => assert.strictEqual(usage.data.monthly_quota_minutes, 30));
}

section("upload quota (free = 10/month) — filled with SCHEDULED posts (no publish)");
{
  const future = new Date(Date.now() + 86400000).toISOString();
  // 10 scheduled text posts via the dashboard route (counts toward quota, never publishes).
  for (let i = 0; i < 10; i++) {
    const f = new FormData();
    f.set("profileId", profileId);
    f.set("type", "text");
    f.set("title", `q${i}`);
    f.set("platforms", JSON.stringify(["x"]));
    f.set("overrides", "{}");
    f.set("mode", "schedule");
    f.set("scheduledAt", future);
    f.set("mediaUrls", "[]");
    f.set("perPlatform", "{}");
    const r = await req("POST", "/api/internal/posts", { form: f, cookie });
    if (r.status !== 200) { console.log(`    (seed post ${i} -> ${r.status})`); break; }
  }
  // The public upload API enforces the monthly cap.
  const over = new FormData();
  over.set("user", "qaprofile");
  over.append("platform[]", "x");
  over.set("title", "should be blocked");
  const res = await req("POST", "/api/upload_text", { form: over, key: apiKey });
  check("11th upload over quota -> 429", () => assert.strictEqual(res.status, 429));
  check("429 mentions the monthly limit", () => assert.match(JSON.stringify(res.data), /(quota|limit|month)/i));
}

await teardown(ctx);
process.exit(done("quotas.test.mjs"));
