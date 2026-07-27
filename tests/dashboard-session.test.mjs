// Dashboard page renders, pipeline persistence across a full reload, and the
// deleted-account session guard. No posting.
// Run: node tests/dashboard-session.test.mjs [baseUrl]

import { req, check, section, done, setup, assert } from "./_harness.mjs";

console.log("\nSocialPost — dashboard pages / session");
const ctx = await setup("dash");
const { cookie, profileId } = ctx;

section("pipeline persists across a full page load (the 'gone after refresh' check)");
{
  const created = await req("POST", "/api/internal/pipelines", {
    json: {
      profileId, name: "Persist QA", platforms: ["facebook"],
      activeDays: ["mon"], slotTimes: ["10:00"], timezone: "UTC", loop: false,
      items: [{ type: "text", title: "keepme", description: "", media: [], perPlatform: {} }],
    },
    cookie,
  });
  check("create pipeline -> 200", () => assert.strictEqual(created.status, 200));
  // Fresh server render of the page (what a browser refresh does):
  const page = await req("GET", "/pipelines", { cookie });
  check("full /pipelines render includes the saved pipeline", () =>
    assert.ok(page.status === 200 && /Persist QA/.test(page.data)));
}

section("all dashboard pages render (authed, 200)");
{
  const pages = [
    "analytics", "pipelines", "calendar", "calendar/queue", "upload", "users",
    "history", "comments", "api-keys", "profile", "profile/invoices", "team", "pricing",
    "connected-apps", "docs",
  ];
  for (const p of pages) {
    const r = await req("GET", `/${p}`, { cookie });
    check(`GET /${p} -> 200`, () => assert.strictEqual(r.status, 200));
  }
}

section("deleted-account session redirects cleanly (no crash)");
{
  const del = await req("DELETE", "/api/internal/account", { cookie });
  check("delete account -> 200", () => assert.strictEqual(del.status, 200));
  // The cookie now points at a deleted account. A dashboard page must redirect
  // to /login, not throw "Cannot read properties of null".
  const stale = await req("GET", "/pipelines", { cookie, redirect: "manual" });
  check("stale-cookie /pipelines -> 3xx (not 500)", () => assert.ok(stale.status >= 300 && stale.status < 400));
  check("redirects to /login", () => assert.match(stale.location ?? "", /\/login/));
}

process.exit(done("dashboard-session.test.mjs"));
