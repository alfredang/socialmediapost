// Account, profiles, API keys, billing entitlements, team, notifications.
// No posting. Run: node tests/account.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — account / billing / team");
const ctx = await setup("acct");
const { cookie } = ctx;

section("account + profiles");
{
  const patch = await req("PATCH", "/api/internal/account", {
    json: { webhookUrl: "https://example.com/hook", calendarWeekStart: "sunday" },
    cookie,
  });
  check("PATCH account (webhook + week start) -> 200", () => assert.strictEqual(patch.status, 200));
  check("setup created a profile", () => assert.ok(ctx.profileId));

  const dup = await req("POST", "/api/internal/profiles", { json: { name: "qaprofile" }, cookie });
  check("duplicate profile name rejected", () => assert.ok(dup.status >= 400));
}

section("API keys");
{
  const k = await req("POST", "/api/internal/keys", { json: { label: "Second" }, cookie });
  check("create key -> 200 + plaintext once", () => {
    assert.strictEqual(k.status, 200);
    assert.match(k.data.key, /^up_[a-f0-9]+$/);
  });
}

section("billing — paid plans cannot be self-granted");
{
  // This endpoint used to write account.plan straight from the request body,
  // so any signed-in user could hand themselves the top tier for free. Paid
  // tiers are now entitlements Stripe grants through the webhook; this route
  // may only move an account down to free.
  for (const plan of ["business", "advanced", "professional", "basic"]) {
    const res = await req("POST", "/api/internal/plan", { json: { plan, interval: "monthly" }, cookie });
    check(`self-granting ${plan} -> 402`, () => assert.strictEqual(res.status, 402));
  }

  const me = await req("GET", "/api/internal/account", { cookie });
  check("plan is still free after the attempts", () => assert.strictEqual(me.data.account?.plan ?? "free", "free"));

  // Checkout is the only route to a paid plan, and it refuses the free plan.
  const freeCheckout = await req("POST", "/api/internal/billing/checkout", { json: { plan: "free" }, cookie });
  check("checkout rejects the free plan -> 400", () => assert.strictEqual(freeCheckout.status, 400));

  const down = await req("POST", "/api/internal/plan", { json: { plan: "free" }, cookie });
  check("downgrade to free -> 200", () => assert.strictEqual(down.status, 200));
  check("plan reported back as free", () => assert.strictEqual(down.data.plan, "free"));

  const notif = await req("GET", "/api/internal/notifications", { cookie });
  check("plan change created a notification", () => assert.ok(notif.data.unread >= 1));
  const read = await req("POST", "/api/internal/notifications", { cookie });
  check("mark notifications read -> 200", () => assert.strictEqual(read.status, 200));
}

section("team (plan-gated)");
{
  // The happy path needs a Professional account, which now requires a real
  // Stripe subscription — so this covers the gate itself, which is the part
  // that has to hold once plans are money-backed.
  const inv = await req("POST", "/api/internal/team", { json: { email: "mate@example.com", role: "member" }, cookie });
  check("free plan cannot invite teammates -> 403", () => assert.strictEqual(inv.status, 403));
  check("no invite created", () => assert.ok(!inv.data.invite));
  check("rejection names the required plan", () => assert.match(inv.data.error, /Professional/i));
}

section("share link (dashboard connect JWT)");
{
  const s = await req("POST", "/api/internal/share-link", { json: { username: "qaprofile" }, cookie });
  check("share-link -> 200 with connect_url", () => {
    assert.strictEqual(s.status, 200);
    assert.match(s.data.connect_url, /\/connect\?token=/);
  });
}

await teardown(ctx);
process.exit(done("account.test.mjs"));
