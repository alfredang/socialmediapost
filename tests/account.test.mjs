// Account, profiles, API keys, simulated billing, team, notifications.
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

section("simulated billing");
{
  const plan = await req("POST", "/api/internal/plan", { json: { plan: "professional", interval: "monthly" }, cookie });
  check("switch to Professional -> 200", () => assert.strictEqual(plan.status, 200));
  check("plan reported back", () => assert.strictEqual(plan.data.plan, "professional"));

  const notif = await req("GET", "/api/internal/notifications", { cookie });
  check("plan change created a notification", () => assert.ok(notif.data.unread >= 1));
  const read = await req("POST", "/api/internal/notifications", { cookie });
  check("mark notifications read -> 200", () => assert.strictEqual(read.status, 200));
}

section("team (plan-gated)");
{
  const inv = await req("POST", "/api/internal/team", { json: { email: "mate@example.com", role: "member" }, cookie });
  check("invite teammate on Professional -> 200", () => assert.strictEqual(inv.status, 200));
  check("invite id returned", () => assert.ok(inv.data.invite?.id));
  const del = await req("DELETE", `/api/internal/team?id=${inv.data.invite.id}`, { cookie });
  check("delete invite -> 200", () => assert.strictEqual(del.status, 200));
  const bad = await req("POST", "/api/internal/team", { json: { email: "not-an-email", role: "member" }, cookie });
  check("invalid email rejected", () => assert.strictEqual(bad.status, 400));
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
