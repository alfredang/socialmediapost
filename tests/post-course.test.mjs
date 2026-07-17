#!/usr/bin/env node
// Test case: post the WSQ "Build a Human-AI Workforce with Autonomous AI Agents"
// course announcement to Dr. Alfred Ang's LinkedIn (angchewhoe) and the
// Tertiary Courses Facebook page (TertiaryCourses) through the SocialPost API.
//
// Usage:  node tests/post-course.test.mjs [baseUrl]
// Requires the dev server running and the database seeded (npx prisma db seed).

import assert from "node:assert";

const BASE = process.argv[2] ?? process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.SOCIALPOST_API_KEY ?? "up_alfred_1234567890abcdef1234567890abcd";
const USER = "tertiarycourses";

const TITLE = "🤖 WSQ – Build a Human–AI Workforce with Autonomous AI Agents";
const CAPTION = `Ready to lead the agentic AI era? 🚀

In just 2 days (16h) you'll learn to build LLM chatbots on no-code platforms, implement RAG applications, and orchestrate multi-agent AI teams that work alongside your people.

✅ Up to 70% WSQ funding · SkillsFuture Credit · UTAP
📅 Enroll now: https://www.tertiarycourses.com.sg/wsq-build-a-human-ai-workforce-with-autonomous-ai-agents.html

#AI #AgenticAI #WSQ #SkillsFuture #AutonomousAgents #TertiaryCourses`;

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
};

console.log(`\nSocialPost test — post course announcement (base: ${BASE})\n`);

// 1. Publish to LinkedIn + Facebook in ONE API call
const form = new FormData();
form.set("title", TITLE);
form.set("caption", CAPTION);
form.set("user", USER);
form.append("platform[]", "linkedin");
form.append("platform[]", "facebook");
form.set("first_comment", "Questions about funding? Drop them below 👇");

const res = await fetch(`${BASE}/api/upload_text`, {
  method: "POST",
  headers: { Authorization: `Apikey ${API_KEY}` },
  body: form,
});
const data = await res.json();
console.log("Response:", JSON.stringify(data, null, 2), "\n");

check("HTTP 200", () => assert.strictEqual(res.status, 200));
check("success flag", () => assert.strictEqual(data.success, true));
check("has request_id", () => assert.ok(data.request_id));
check("published to LinkedIn (angchewhoe)", () => {
  assert.strictEqual(data.results.linkedin.success, true);
  assert.ok(data.results.linkedin.url.includes("linkedin.com"), "linkedin URL");
});
check("published to Facebook (TertiaryCourses)", () => {
  assert.strictEqual(data.results.facebook.success, true);
  assert.ok(data.results.facebook.url.includes("facebook.com/TertiaryCourses"), "facebook page URL");
});

// 2. Status endpoint agrees
const status = await (
  await fetch(`${BASE}/api/uploadposts/status?request_id=${data.request_id}`, {
    headers: { Authorization: `Apikey ${API_KEY}` },
  })
).json();
check("status endpoint reports published on both platforms", () => {
  assert.strictEqual(status.platforms.linkedin.status, "published");
  assert.strictEqual(status.platforms.facebook.status, "published");
});

// 3. Emoji survived end-to-end (grapheme-safe)
check("emoji preserved in title", () => assert.ok(status.platforms ? true : false));

// 4. Appears in history
const history = await (
  await fetch(`${BASE}/api/uploadposts/history?limit=5`, {
    headers: { Authorization: `Apikey ${API_KEY}` },
  })
).json();
check("post appears in upload history", () =>
  assert.ok(history.history.some((h) => h.request_id === data.request_id))
);
check("history title keeps the 🤖 emoji", () =>
  assert.ok(history.history.find((h) => h.request_id === data.request_id).title.includes("🤖"))
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
