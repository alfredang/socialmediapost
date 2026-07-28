// Runs the whole non-posting functional suite in sequence and aggregates the
// result. Each file self-provisions a throwaway account and cleans up.
//
//   node tests/run-all.mjs [baseUrl]
//   npm test
//
// Requires the dev server running (npm run dev / npm start) and reachable at
// baseUrl (default http://localhost:3000). Does NOT publish to any platform;
// the posting scenario (tests/post-course.test.mjs) is intentionally excluded.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? process.env.SOCIALPOST_BASE_URL ?? "http://localhost:3000";

const FILES = [
  "auth.test.mjs",
  "account.test.mjs",
  "public-api.test.mjs",
  "queue-media.test.mjs",
  "drafts.test.mjs",
  "pipelines.test.mjs",
  "authz.test.mjs",
  "quotas.test.mjs",
  "dashboard-session.test.mjs",
  "webhook.test.mjs",
  "sdk.test.mjs",
];

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, file), baseUrl], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

console.log(`\n==== SocialPost functional suite (non-posting) — ${baseUrl} ====`);
let failedFiles = 0;
for (const f of FILES) {
  const code = await run(f);
  if (code !== 0) failedFiles++;
}
console.log(`\n==== ${FILES.length - failedFiles}/${FILES.length} files passed ====\n`);
process.exit(failedFiles ? 1 : 0);
