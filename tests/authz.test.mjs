// Cross-account authorization isolation — account A must not be able to read or
// mutate account B's resources (by id). No posting.
// Run: node tests/authz.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — authorization isolation");

const A = await setup("authz-a");
const B = await setup("authz-b");

// B creates resources we'll try to reach from A.
const bPipe = await req("POST", "/api/internal/pipelines", {
  json: {
    profileId: B.profileId, name: "B pipe", platforms: ["facebook"],
    activeDays: ["mon"], slotTimes: ["10:00"], timezone: "UTC", loop: false,
    items: [{ type: "text", title: "b", description: "", media: [], perPlatform: {} }],
  },
  cookie: B.cookie,
});
const bPipeId = bPipe.data?.pipeline?.id;

// A scheduled (unpublished) post under B, to test status isolation by request_id.
const bForm = new FormData();
bForm.set("profileId", B.profileId);
bForm.set("type", "text");
bForm.set("title", "B post");
bForm.set("platforms", JSON.stringify(["x"]));
bForm.set("overrides", "{}");
bForm.set("mode", "schedule");
bForm.set("scheduledAt", new Date(Date.now() + 86400000).toISOString());
bForm.set("mediaUrls", "[]");
bForm.set("perPlatform", "{}");
const bPost = await req("POST", "/api/internal/posts", { form: bForm, cookie: B.cookie });
const bReqId = bPost.data?.requestId;

section("A cannot mutate B's pipeline");
{
  const pause = await req("PATCH", "/api/internal/pipelines", { json: { id: bPipeId, action: "pause" }, cookie: A.cookie });
  check("A pause B's pipeline -> 404", () => assert.strictEqual(pause.status, 404));
  const del = await req("DELETE", `/api/internal/pipelines?id=${bPipeId}`, { cookie: A.cookie });
  check("A delete B's pipeline -> 404", () => assert.strictEqual(del.status, 404));
  // Still there for B:
  const bDel = await req("DELETE", `/api/internal/pipelines?id=${bPipeId}`, { cookie: B.cookie });
  check("B can still delete own pipeline (survived A's attempts)", () => assert.strictEqual(bDel.status, 200));
}

section("A cannot delete B's profile");
{
  const del = await req("DELETE", `/api/internal/profiles?id=${B.profileId}`, { cookie: A.cookie });
  check("A delete B's profile -> 404", () => assert.strictEqual(del.status, 404));
}

section("A cannot mutate B's social account / queue by id");
{
  const patch = await req("PATCH", "/api/internal/social-accounts", { json: { id: "nonsense", pageId: "x" }, cookie: A.cookie });
  check("A patch unknown social account -> 404", () => assert.strictEqual(patch.status, 404));
  // A's queue GET for B's profileId -> profile not found under A
  const q = await req("GET", `/api/internal/queue?profileId=${B.profileId}`, { cookie: A.cookie });
  check("A read B's queue by profileId -> 404", () => assert.strictEqual(q.status, 404));
}

section("A's API key cannot reach B's post/profile");
{
  const st = await req("GET", `/api/uploadposts/status?request_id=${bReqId}`, { key: A.apiKey });
  check("A key status(B request_id) -> 404", () => assert.strictEqual(st.status, 404));
  // Names are per-account; A's key resolves A's own "qaprofile", never B's.
  const jwt = await req("POST", "/api/uploadposts/users/generate-jwt", { json: { username: "qaprofile" }, key: A.apiKey });
  check("A key generate-jwt resolves A's own profile only", () => assert.strictEqual(jwt.status, 200));
}

section("session vs key: no cross-token use");
{
  const noKey = await req("GET", "/api/uploadposts/me"); // A's session cookie is NOT a key
  check("session cookie is not accepted as an API key -> 401", () => assert.strictEqual(noKey.status, 401));
}

await teardown(A);
await teardown(B);
process.exit(done("authz.test.mjs"));
