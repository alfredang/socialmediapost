// Pipelines — create (incl. per-platform content), validation, manage, delete.
// Never runs a pipeline (no publish). Run: node tests/pipelines.test.mjs [baseUrl]

import { req, check, section, done, setup, teardown, assert } from "./_harness.mjs";

console.log("\nSocialPost — pipelines");
const ctx = await setup("pipe");
const { cookie, profileId } = ctx;

const base = (over = {}) => ({
  profileId,
  name: "QA pipe",
  platforms: ["facebook"],
  activeDays: ["mon", "wed", "fri"],
  slotTimes: ["10:00"],
  timezone: "Asia/Singapore",
  loop: false,
  items: [{ type: "text", title: "hi", description: "world", media: [], perPlatform: {} }],
  ...over,
});

let pipelineId;

section("create + persistence");
{
  const r = await req("POST", "/api/internal/pipelines", { json: base(), cookie });
  check("create text pipeline -> 200", () => assert.strictEqual(r.status, 200));
  pipelineId = r.data.pipeline?.id;
  check("pipeline persisted with an id", () => assert.ok(pipelineId));
  check("item stored", () => assert.strictEqual(r.data.pipeline.items.length, 1));

  // Re-read via the page-backing data isn't exposed over API, but a second
  // create + list-independent check: the dashboard page renders it (see
  // dashboard-session.test.mjs). Here we confirm it survives by managing it.
}

section("per-platform pipeline item");
{
  const r = await req("POST", "/api/internal/pipelines", {
    json: base({
      name: "QA per-platform",
      platforms: ["tiktok", "instagram"],
      items: [{
        type: "video",
        title: "launch",
        media: [{ path: "", name: "https://example.com/v.mp4", mime: "url" }],
        perPlatform: { instagram: { type: "photos", media: [{ path: "", name: "https://example.com/p.jpg", mime: "url" }] } },
      }],
    }),
    cookie,
  });
  check("create per-platform pipeline -> 200", () => assert.strictEqual(r.status, 200));
  check("perPlatform persisted on the item", () => {
    const pp = JSON.parse(r.data.pipeline.items[0].perPlatform);
    assert.strictEqual(pp.instagram.type, "photos");
  });
  await req("DELETE", `/api/internal/pipelines?id=${r.data.pipeline.id}`, { cookie });
}

section("validation");
{
  const textOnIg = await req("POST", "/api/internal/pipelines", {
    json: base({ platforms: ["instagram"], items: [{ type: "text", title: "x" }] }),
    cookie,
  });
  check("text item on Instagram pipeline -> 400", () => assert.strictEqual(textOnIg.status, 400));

  const noMedia = await req("POST", "/api/internal/pipelines", {
    json: base({ platforms: ["instagram"], items: [{ type: "video", title: "x" }] }),
    cookie,
  });
  check("video item with no media -> 400", () => assert.strictEqual(noMedia.status, 400));

  const noPlatform = await req("POST", "/api/internal/pipelines", { json: base({ platforms: [] }), cookie });
  check("no platforms -> 400", () => assert.strictEqual(noPlatform.status, 400));
}

section("manage + delete");
{
  const pause = await req("PATCH", "/api/internal/pipelines", { json: { id: pipelineId, action: "pause" }, cookie });
  check("pause -> 200", () => assert.strictEqual(pause.status, 200));
  const resume = await req("PATCH", "/api/internal/pipelines", { json: { id: pipelineId, action: "resume" }, cookie });
  check("resume -> 200", () => assert.strictEqual(resume.status, 200));
  const add = await req("PATCH", "/api/internal/pipelines", {
    json: { id: pipelineId, addItem: { type: "text", title: "another" } }, cookie,
  });
  check("add text item -> 200", () => assert.strictEqual(add.status, 200));
  const del = await req("DELETE", `/api/internal/pipelines?id=${pipelineId}`, { cookie });
  check("delete pipeline -> 200", () => assert.strictEqual(del.status, 200));
  const delAgain = await req("DELETE", `/api/internal/pipelines?id=${pipelineId}`, { cookie });
  check("delete missing pipeline -> 404", () => assert.strictEqual(delAgain.status, 404));
}

await teardown(ctx);
process.exit(done("pipelines.test.mjs"));
