// Drives the real Node SDK against a running server through guard-rail paths, so
// its request plumbing (Apikey header, params, path-encoding, JSON parsing) is
// actually exercised — not just syntax-checked.
// Run: node tests/sdk.test.mjs [baseUrl]
import { BASE, check, section, done, setup, teardown, assert } from "./_harness.mjs";
import { SocialPost } from "../sdks/node/index.mjs";

console.log("\nSocialPost — Node SDK (live plumbing)");
const ctx = await setup("sdk");
const client = new SocialPost(ctx.apiKey, { baseUrl: BASE });

section("authenticated reads");
{
  const me = await client.me();
  check("me() → plan + limits", () => assert.ok(me.success && me.plan && me.limits));

  const pm = await client.platformMetrics();
  check("platformMetrics() → platforms map", () => assert.ok(pm.success && pm.platforms.instagram));

  const sched = await client.scheduled();
  check("scheduled() → success", () => assert.ok(sched.success && Array.isArray(sched.scheduled)));

  const media = await client.media({ user: "qaprofile" });
  check("media({user}) → success", () => assert.ok(media.success && Array.isArray(media.media)));
}

section("guard-rail paths surface API errors, not exceptions");
{
  const pa = await client.postAnalytics("does-not-exist");
  check("postAnalytics(missing) → success:false", () => assert.strictEqual(pa.success, false));

  const cm = await client.comments("does-not-exist");
  check("comments(missing) → success:false", () => assert.strictEqual(cm.success, false));

  const badKey = new SocialPost("up_bogus", { baseUrl: BASE });
  const unauth = await badKey.me();
  check("bad key → success:false (401 body parsed, no throw)", () => assert.strictEqual(unauth.success, false));
}

await teardown(ctx);
process.exit(done("sdk.test.mjs"));
