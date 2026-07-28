// Drafts via the dashboard Upload API, including per-platform content overrides
// and validation. Uses draft/queue modes only — never publishes.
// Run: node tests/drafts.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — drafts / per-platform content");
const ctx = await setup("draft");
const { cookie, apiKey, profileId } = ctx;

// Build the multipart body the Upload page sends.
function postForm({ type, platforms, perPlatform = {}, mediaUrls = [], mode = "draft" }) {
  const f = new FormData();
  f.set("profileId", profileId);
  f.set("type", type);
  f.set("title", "QA");
  f.set("description", "cap");
  f.set("platforms", JSON.stringify(platforms));
  f.set("overrides", "{}");
  f.set("mode", mode);
  f.set("mediaUrls", JSON.stringify(mediaUrls));
  f.set("perPlatform", JSON.stringify(perPlatform));
  return f;
}

section("per-platform draft creation");
{
  // Base photos to Facebook; Instagram overridden to video.
  const r = await req("POST", "/api/internal/posts", {
    form: postForm({
      type: "photos",
      platforms: ["facebook", "instagram"],
      mediaUrls: ["https://example.com/base.jpg"],
      perPlatform: { instagram: { type: "video", media: [{ path: "", name: "https://example.com/ig.mp4", mime: "url" }] } },
    }),
    cookie,
  });
  check("create per-platform draft -> 200", () => assert.strictEqual(r.status, 200));
  const reqId = r.data.requestId;
  check("returns a requestId", () => assert.ok(reqId));

  // Status endpoint should list both platforms.
  const st = await req("GET", `/api/uploadposts/status?request_id=${reqId}`, { key: apiKey });
  check("status lists both targets", () =>
    assert.ok(st.data.platforms.facebook && st.data.platforms.instagram));

  // Post-analytics on a fresh draft: metrics are uncollected, so numbers must be
  // null (not a measured 0) and collected_at must be null.
  const pa = await req("GET", `/api/uploadposts/post-analytics/${reqId}`, { key: apiKey });
  check("post-analytics for known post -> 200", () => assert.strictEqual(pa.status, 200));
  check("uncollected metrics are null, not 0", () => {
    const fb = pa.data.platforms.facebook;
    assert.strictEqual(fb.views, null);
    assert.strictEqual(fb.likes, null);
    assert.strictEqual(fb.comments, null);
    assert.strictEqual(fb.shares, null);
  });
  check("uncollected metrics report collected_at: null", () =>
    assert.strictEqual(pa.data.platforms.facebook.collected_at, null));

  // Comments on an unpublished draft: the FB target exists but isn't published,
  // so the endpoint refuses (400) rather than calling Graph or faking a list.
  const cm = await req("GET", `/api/uploadposts/comments?request_id=${reqId}`, { key: apiKey });
  check("comments on unpublished FB post -> 400", () => assert.strictEqual(cm.status, 400));
  const cmIg = await req("GET", `/api/uploadposts/comments?request_id=${reqId}&platform=instagram`, { key: apiKey });
  check("comments on unpublished IG post -> 400", () => assert.strictEqual(cmIg.status, 400));

  // Queue it (schedules, doesn't publish).
  const q = await req("POST", "/api/uploadposts/add_to_queue", { json: { request_id: reqId }, key: apiKey });
  check("add_to_queue schedules the draft", () => assert.ok(q.status === 200 && q.data.scheduled_date));
}

section("validation rejects impossible content");
{
  const textOnIg = await req("POST", "/api/internal/posts", {
    form: postForm({ type: "photos", platforms: ["instagram"], mediaUrls: ["https://example.com/x.jpg"],
      perPlatform: { instagram: { type: "text", media: [] } } }),
    cookie,
  });
  check("Instagram text override -> 400", () => assert.strictEqual(textOnIg.status, 400));

  const noMedia = await req("POST", "/api/internal/posts", {
    form: postForm({ type: "photos", platforms: ["facebook"], mediaUrls: [] }),
    cookie,
  });
  check("photos post with no media -> 400", () => assert.strictEqual(noMedia.status, 400));

  const traversal = await req("POST", "/api/internal/posts", {
    form: postForm({ type: "photos", platforms: ["instagram"], mediaUrls: ["https://example.com/x.jpg"],
      perPlatform: { instagram: { type: "photos", media: [{ path: "../../../../etc/passwd", name: "p", mime: "image/jpeg" }] } } }),
    cookie,
  });
  // The forged path is stripped by sanitizeStoredMedia → override has no media → 400.
  check("path-traversal media rejected -> 400", () => assert.strictEqual(traversal.status, 400));
}

await teardown(ctx);
process.exit(done("drafts.test.mjs"));
