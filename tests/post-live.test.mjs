#!/usr/bin/env node
// GUARDED live-publish harness. This posts FOR REAL to a connected account.
// It is intentionally NOT part of `npm test` (run-all excludes it).
//
// The API key is read from YOUR environment — never hard-code it, commit it, or
// paste it into a chat. Dry-run by default; it sends nothing until you set
// SOCIALPOST_CONFIRM=yes.
//
// Usage:
//   SOCIALPOST_API_KEY=up_...            # a key for the account with the connected socials
//   SOCIALPOST_USER=<profile name>       # e.g. the profile that owns the account
//   [SOCIALPOST_TYPE=text|photos|video]  # inferred from the media file if omitted
//   [SOCIALPOST_MEDIA_FILE=./clip.mp4]   # required for photos/video (comma-separate for a carousel)
//   [SOCIALPOST_TITLE="..."]             # defaults to a timestamped marker
//   [SOCIALPOST_BASE_URL=http://localhost:3000]
//   [SOCIALPOST_CONFIRM=yes]             # WITHOUT this it's a dry run
//   node tests/post-live.test.mjs <platform>
//
// Examples:
//   # Dry run (shows the request, sends nothing):
//   SOCIALPOST_API_KEY=up_x SOCIALPOST_USER=jun node tests/post-live.test.mjs tiktok
//   # Real, private-by-default TikTok video (unaudited apps post SELF_ONLY):
//   SOCIALPOST_API_KEY=up_x SOCIALPOST_USER=jun SOCIALPOST_MEDIA_FILE=./clip.mp4 \
//     SOCIALPOST_CONFIRM=yes node tests/post-live.test.mjs tiktok

import { readFile } from "node:fs/promises";
import path from "node:path";

const platform = (process.argv[2] ?? "").toLowerCase();
const BASE = (process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SOCIALPOST_API_KEY ?? "";
const USER = process.env.SOCIALPOST_USER ?? "";
const CONFIRM = process.env.SOCIALPOST_CONFIRM === "yes";
const TITLE = process.env.SOCIALPOST_TITLE ?? `SocialPost live test — safe to delete (${new Date().toISOString()})`;
const MEDIA = (process.env.SOCIALPOST_MEDIA_FILE ?? "").trim();

// Per-platform visibility reality, printed before you commit to posting.
const VISIBILITY = {
  tiktok: "Unaudited apps publish SELF_ONLY (private) — only you can see it. Safe.",
  linkedin: "Publishes PUBLIC (visibility is hardcoded). Delete it after, or switch to CONNECTIONS.",
  facebook: "Publishes to your Page and is PUBLIC. Keep it private by using an Unpublished Page.",
  instagram: "Publishes PUBLIC to your IG. No private mode — use a throwaway pro account or delete after.",
};

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!platform) fail("Pass a platform, e.g.  node tests/post-live.test.mjs tiktok");
if (!KEY) fail("Set SOCIALPOST_API_KEY in your environment (do not paste it into chat).");
if (!USER) fail("Set SOCIALPOST_USER to the profile name that owns the connected account.");

// Decide the post type.
let type = (process.env.SOCIALPOST_TYPE ?? "").toLowerCase();
if (!type) {
  if (!MEDIA) type = "text";
  else if (/\.(mp4|mov|webm|m4v)$/i.test(MEDIA)) type = "video";
  else type = "photos";
}
if (!["text", "photos", "video"].includes(type)) fail(`Unsupported SOCIALPOST_TYPE "${type}".`);
if (type !== "text" && !MEDIA) fail(`A ${type} post needs SOCIALPOST_MEDIA_FILE.`);

const ENDPOINT = { text: "/api/upload_text", photos: "/api/upload_photos", video: "/api/upload" }[type];

console.log(`\n── SocialPost live publish ──`);
console.log(`  base:     ${BASE}`);
console.log(`  endpoint: POST ${ENDPOINT}`);
console.log(`  profile:  ${USER}`);
console.log(`  platform: ${platform}`);
console.log(`  type:     ${type}${MEDIA ? `  media: ${MEDIA}` : ""}`);
console.log(`  title:    ${TITLE}`);
console.log(`  key:      ${KEY.slice(0, 6)}… (from env)`);
console.log(`\n  ⚠ visibility: ${VISIBILITY[platform] ?? "Publishes PUBLICLY to your account."}`);

if (!CONFIRM) {
  console.log(`\n  DRY RUN — nothing sent. Re-run with SOCIALPOST_CONFIRM=yes to publish for real.\n`);
  process.exit(0);
}

// Build the multipart body the public API expects.
const form = new FormData();
form.set("user", USER);
form.append("platform[]", platform);
form.set("title", TITLE);

if (type !== "text") {
  const files = MEDIA.split(",").map((s) => s.trim()).filter(Boolean);
  for (const fp of files) {
    let buf;
    try {
      buf = await readFile(fp);
    } catch {
      fail(`Can't read media file: ${fp}`);
    }
    const field = type === "video" ? "video" : "photos[]";
    form.append(field, new Blob([buf]), path.basename(fp));
  }
}

console.log(`\n  Publishing…`);
let res, data;
try {
  res = await fetch(`${BASE}${ENDPOINT}`, { method: "POST", headers: { Authorization: `Apikey ${KEY}` }, body: form });
  data = await res.json();
} catch (e) {
  fail(`Request failed: ${e.message}. Is the server running at ${BASE}?`);
}

console.log(`\n  HTTP ${res.status}`);
console.log(`  ${JSON.stringify(data, null, 2).split("\n").join("\n  ")}`);

const result = data?.results?.[platform];
if (data?.success && result?.success && result.url) {
  console.log(`\n  ✅ Published: ${result.url}`);
  console.log(`  🗑  Delete it now in the ${platform} app/site if this was only a test.`);
  process.exit(0);
} else {
  console.log(`\n  ✗ Not published — see the error above.`);
  process.exit(1);
}
