// Queue config + occupancy-aware preview, media staging, FFmpeg. No posting.
// Run: node tests/queue-media.test.mjs [baseUrl]

import { BASE, req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — queue / media / ffmpeg");
const ctx = await setup("queue");
const { cookie, apiKey, profileId } = ctx;

section("queue config + preview");
{
  const g = await req("GET", `/api/internal/queue?profileId=${profileId}`, { cookie });
  check("GET queue -> 200 with slots", () => assert.ok(g.status === 200 && Array.isArray(g.data.slots)));
  check("fresh profile: all slots available", () => assert.ok(g.data.slots.every((s) => s.available)));

  const put = await req("PUT", "/api/internal/queue", {
    json: { profileId, timezone: "Asia/Singapore", activeDays: ["mon"], slotTimes: ["09:00"], maxPerSlot: 1 },
    cookie,
  });
  check("PUT settings -> 200", () => assert.strictEqual(put.status, 200));

  // Live preview for an unsaved config (Saturday only) — should return Saturdays.
  const prev = await req("POST", "/api/internal/queue", {
    json: { profileId, timezone: "Asia/Singapore", activeDays: ["sat"], slotTimes: ["09:00"], maxPerSlot: 1 },
    cookie,
  });
  const weekdays = new Set(prev.data.slots.map((s) => new Date(s.time).getUTCDay()));
  // 09:00 SGT = 01:00 UTC same day → Saturday = 6.
  check("live preview reflects unsaved config (Saturdays only)", () =>
    assert.ok([...weekdays].every((d) => d === 6)));

  const empty = await req("POST", "/api/internal/queue", {
    json: { profileId, timezone: "UTC", activeDays: [], slotTimes: ["09:00"], maxPerSlot: 1 },
    cookie,
  });
  check("no active days -> empty preview", () => assert.strictEqual(empty.data.slots.length, 0));
}

section("media staging (path-traversal-safe)");
{
  const form = new FormData();
  form.set("media", new Blob(["JPEGDATA"], { type: "image/jpeg" }), "tiny.jpg");
  const r = await req("POST", "/api/internal/media", { form, cookie });
  check("stage upload -> 200", () => assert.strictEqual(r.status, 200));
  const key = r.data.media?.[0]?.path ?? "";
  check("staged key is basename-only (no separators)", () => assert.ok(key && !/[\\/]/.test(key)));
}

section("FFmpeg — real or fail-loud (never fake success)");
{
  const usage = await req("GET", "/api/uploadposts/ffmpeg/usage", { key: apiKey });
  check("ffmpeg usage -> 200", () => assert.strictEqual(usage.status, 200));

  const job = await req("POST", "/api/uploadposts/ffmpeg/job", {
    json: { media_url: "https://example.com/v.mp4", operation: "to_vertical" },
    key: apiKey,
  });
  // 503 when ffmpeg isn't installed; 200 with a real output_url when it is.
  check("ffmpeg job -> 503 (no binary) or 200 (real output)", () => assert.ok([200, 503].includes(job.status)));
  if (job.status === 200) check("200 returns an output_url", () => assert.ok(job.data.output_url));
  if (job.status === 503) check("503 says ffmpeg not installed", () => assert.match(job.data.error, /ffmpeg/i));

  const badop = await req("POST", "/api/uploadposts/ffmpeg/job", {
    json: { media_url: "https://example.com/v.mp4", operation: "rm -rf" },
    key: apiKey,
  });
  check("unknown operation -> 400 or 503", () => assert.ok([400, 503].includes(badop.status)));
}

await teardown(ctx);
process.exit(done("queue-media.test.mjs"));
