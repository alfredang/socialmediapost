#!/usr/bin/env node
// GUARDED live read: asserts the Facebook Page list for a REAL connected account.
// Read-only — it publishes nothing, so there's no CONFIRM gate. It is NOT part of
// `npm test` (run-all excludes it) because the throwaway QA accounts the suite
// provisions have no real Facebook connection.
//
// The API key is read from YOUR environment — never hard-code it, commit it, or
// paste it into a chat.
//
// Usage:
//   SOCIALPOST_API_KEY=up_...       # a key for the account with the connected FB Page
//   SOCIALPOST_USER=<profile name>  # the profile that owns the Facebook connection
//   [SOCIALPOST_BASE_URL=http://localhost:3000]
//   node tests/pages-live.test.mjs

import assert from "node:assert";

const BASE = (process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SOCIALPOST_API_KEY ?? "";
const USER = process.env.SOCIALPOST_USER ?? "";

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!KEY) fail("Set SOCIALPOST_API_KEY in your environment (do not paste it into chat).");
if (!USER) fail("Set SOCIALPOST_USER to the profile name that owns the connected Facebook account.");

console.log(`\n── SocialPost live Facebook Page list ──`);
console.log(`  base:    ${BASE}`);
console.log(`  profile: ${USER}`);
console.log(`  key:     ${KEY.slice(0, 6)}… (from env)\n`);

let res, data;
try {
  res = await fetch(`${BASE}/api/uploadposts/pages?user=${encodeURIComponent(USER)}&platform=facebook`, {
    headers: { Authorization: `Apikey ${KEY}` },
  });
  data = await res.json();
} catch (e) {
  fail(`Request failed: ${e.message}. Is the server running at ${BASE}?`);
}

if (res.status !== 200) {
  fail(`HTTP ${res.status}: ${data?.error ?? "unexpected response"}${data?.reconnect ? " (reconnect the Facebook account on the Users page)" : ""}`);
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

check("success is true", () => assert.strictEqual(data.success, true));
check("platform echoes facebook", () => assert.strictEqual(data.platform, "facebook"));
check("pages is a non-empty array", () => {
  assert.ok(Array.isArray(data.pages), "pages is not an array");
  assert.ok(data.pages.length > 0, "no Pages returned — is a Page actually connected?");
});
check("every page has an id and name", () =>
  data.pages.forEach((p) => {
    assert.ok(p.id, "a page is missing id");
    assert.ok(p.name, "a page is missing name");
  }));
check("no page token is ever leaked", () =>
  data.pages.forEach((p) => assert.ok(!("access_token" in p), "a page leaked an access_token")));
check("exactly one page is marked connected", () => {
  const connected = data.pages.filter((p) => p.connected);
  assert.strictEqual(connected.length, 1, `expected 1 connected page, got ${connected.length}`);
});
check("connected_page_id matches the connected page", () => {
  const connected = data.pages.find((p) => p.connected);
  assert.strictEqual(data.connected_page_id, connected?.id);
});

console.log(`\n  Pages:`);
for (const p of data.pages) {
  console.log(`   ${p.connected ? "●" : "○"} ${p.name}  (${p.id})`);
}

console.log(`\npages-live.test.mjs: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
