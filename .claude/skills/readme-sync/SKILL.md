---
name: readme-sync
description: Keeps the root README.md accurate and on-voice as the app changes. The README is a product showcase — hero pitch, shields.io badges, Features list, curl lead-magnet, API-surface table, SDK table, project-structure tree, Quick start, seeded logins, Testing — and every section silently drifts from the code. Use after adding/renaming/removing an API endpoint or dashboard page, changing a dependency version, changing auth flows, swapping the database, altering SDKs, changing npm scripts / env vars, or when asked to "update the README" — to reconcile each section against its real source of truth and preserve the file's voice.
---

# README Sync — SocialPost

There is **one README** in this repo: [README.md](../../../README.md) (root) — a **product showcase**: hero pitch ("One API call to post on every social platform"), shields.io badges, Features bullets, the curl lead-magnet block, API-surface table, SDK table, project-structure tree, Quick start, seeded logins, Testing. Marketing-lite, but **every claim must be true**.

## Golden rule

**Read the source before you touch a number, name, version, flag, or path.** Every claim has a file that owns it — open that file; don't trust the README's current value (it may be the stale one). Don't `git add`/commit unless asked — that's [/git-push](../../commands/git-push.md)'s job.

## Section → source of truth

| Section | Verify against |
| --- | --- |
| **Badges** (Next.js, React, TypeScript, Tailwind, Prisma, database) | [package.json](../../../package.json) `dependencies`. Badge ↔ prose must state the same major versions. |
| **Database badge/claims** | [prisma/schema.prisma](../../../prisma/schema.prisma) `datasource` provider. The app moved **SQLite → PostgreSQL** (commit `c33ef6d`); any remaining SQLite/`dev.db` mention is stale. |
| **Features bullets** | The real routes: API under [src/app/api/](../../../src/app/api/), dashboard pages under `src/app/(dashboard)/`, platform registry in [src/lib/platforms.ts](../../../src/lib/platforms.ts) (count the platforms before claiming "22 networks"). |
| **"Connectors are simulated" claim** | [src/lib/platforms.ts](../../../src/lib/platforms.ts) + [src/lib/publish.ts](../../../src/lib/publish.ts). **Instagram now has a real OAuth flow** ([src/app/api/auth/instagram/](../../../src/app/api/auth/instagram/), [src/lib/instagram.ts](../../../src/lib/instagram.ts)) — don't claim everything is simulated if real connectors have landed; state which are live vs simulated. |
| **Auth features** | The routes under [src/app/api/auth/](../../../src/app/api/auth/) — Google OAuth, magic-link/OTP, **and the newer password `login`/`register` routes** — plus [src/app/login/page.tsx](../../../src/app/login/page.tsx). "Passwordless only" is stale once password auth ships. |
| **curl lead-magnet + API-surface table** | Route folders under [src/app/api/](../../../src/app/api/). Endpoint paths must exist exactly as written. |
| **SDK table** | The folders under [sdks/](../../../sdks/) (python · node · n8n · vscode · mcp) and each SDK's own README/package name. |
| **Quick start** | [package.json](../../../package.json) `scripts` + Prisma workflow: `npx prisma migrate dev` needs a running **PostgreSQL** and `DATABASE_URL` in `.env` now — a SQLite-era "just works" quick start is stale. Port is **3000**. Seed command is `npx prisma db seed`. |
| **Seeded logins** | [prisma/seed.ts](../../../prisma/seed.ts) — the actual seeded accounts (`demo@example.com`, admin) and password if password auth is live. |
| **Env vars** (if listed) | `.env` keys actually read via `process.env` in [src/lib/](../../../src/lib/) (mail, instagram, session, base-url). Never print real values — names only. |
| **Testing** | [tests/](../../../tests/) — currently `post-course.test.mjs`; keep the assertion count honest. |
| **Deployment** | [Dockerfile](../../../Dockerfile) + [docker-entrypoint.sh](../../../docker-entrypoint.sh): Coolify-ready, entrypoint runs `prisma db push` + idempotent seed then `npm start`. |
| **Screenshot** | `screenshot.png` at repo root — **never reference an image that isn't there**, and flag it if the UI has visibly changed since capture. |
| **Project structure tree** | The real tree under [src/](../../../src/); keep the one-line purpose comments accurate (dashboard page list, lib modules). |

## Voice & format (preserve, don't "improve")

- Keep the emoji-in-title (`# SocialPost 🛫`), badge row, bold-lead feature bullets, and the blockquote caveat style.
- Honest — no aspirational features. If it's not shipped in the code, it's not in the README as done.
- Keep the footer: `Powered by [Tertiary Infotech Academy Pte Ltd](https://www.tertiaryinfotech.com/)`.
- The acknowledgements line describes the design as "dark-first, emerald 'code' theme, Space Grotesk + JetBrains Mono" — verify against [src/app/globals.css](../../../src/app/globals.css) before editing it.

## Known-stale spots to check first (as of 2026-07-22)

- **Next.js badge says 15** — [package.json](../../../package.json) has `next 16.2.10`. Fix badge + any prose.
- **SQLite badge + `prisma/dev.db` mentions** — schema is now `postgresql`. Update badge, Quick start (`migrate dev` needs `DATABASE_URL`), and the "creates prisma/dev.db" comment.
- **"Auth — Google OAuth + email magic-link/OTP (passwordless)"** — password `login`/`register` routes and an Instagram OAuth connector have landed; reconcile.
- **"Platform connectors are simulated"** — partially stale once the Instagram connector is real.

## Workflow

1. Identify which README section(s) the change touches.
2. For each, **open the source-of-truth file** and diff it against the README text.
3. Edit only the drifted lines; preserve surrounding format, emoji, and voice.
4. Keep the README numerically consistent (a version/count appears in badge + prose — update all occurrences).
5. Summarise what changed and which source proved the old value stale. Leave committing to [/git-push](../../commands/git-push.md).
