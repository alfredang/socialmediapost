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
  "composer-preview.test.mts",
  "platform-adapters.test.mts",
];

// .mts files import app TypeScript directly, so node loads them through tsx;
// plain .mjs runs on node as before. Both spawn node itself with NO shell:
// under `shell: true` arguments are concatenated rather than escaped (Node
// DEP0190), so any path containing a space — a "Program Files" install, or a
// checkout under "My Documents" — silently fails to launch.
function run(file) {
  return new Promise((resolve) => {
    const target = path.join(dir, file);
    const args = file.endsWith(".mts")
      ? ["--import", "tsx", target, baseUrl]
      : [target, baseUrl];
    const child = spawn(process.execPath, args, { stdio: "inherit" });
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
