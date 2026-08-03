# Tests

Black-box functional tests. Plain Node (`node:assert`, global `fetch`) — no framework.

A few files are **pure unit tests** that need no server (`webhook`,
`composer-preview`). `.mts` files import app TypeScript directly and are run
through `tsx` by `run-all.mjs`; everything else runs on plain `node`.

## Run

Start the app first, then point the suite at it:

```bash
npm run dev                 # or: npm start   (needs the DB up)
npm test                    # runs the whole non-posting suite at http://localhost:3000
npm test -- http://localhost:3121   # against a different base URL
```

Run one file:

```bash
node tests/pipelines.test.mjs http://localhost:3000
```

## What's covered

`run-all.mjs` runs the **non-posting** suite — everything except actually
publishing to a social platform. Each file **self-provisions** a throwaway
account (`qa-*@example.test`) + profile + API key and **deletes it at the end**,
so the tests depend on nothing in the database and never touch real accounts.

| File | Area |
|------|------|
| `auth.test.mjs` | register/login, OTP (mail-required, no code leak), Google gating, magic link |
| `account.test.mjs` | account/profile, API keys, simulated billing, team, notifications, share-link |
| `public-api.test.mjs` | key auth, `/me`, whitelabel JWT, retired `/api/connect` (410), per-platform metrics, analytics reads, public reads |
| `queue-media.test.mjs` | queue config + occupancy-aware live preview, media staging, FFmpeg (real or 503) |
| `drafts.test.mjs` | per-platform draft creation + validation (draft/queue modes only) |
| `pipelines.test.mjs` | pipeline create incl. per-platform content, validation, manage, delete |
| `authz.test.mjs` | cross-account isolation — account A can't read/mutate B's pipeline, profile, queue, or post |
| `quotas.test.mjs` | free-plan limits — profiles (429), team seats (403), ffmpeg minutes, uploads/month (429, filled with scheduled posts so nothing publishes) |
| `dashboard-session.test.mjs` | pipeline persists across a full reload, all dashboard pages render, deleted-account redirect |
| `webhook.test.mjs` | SDK `parseWebhookEvent` — parses `post.completed`, rejects unknown/malformed (pure unit, no server) |
| `sdk.test.mjs` | Node SDK live plumbing — authed reads + guard-rail paths return parsed API errors, never throw |
| `composer-preview.test.mts` | Upload composer side panel — post type, thumbnail, summary line, submit gating (pure unit, no server) |

## Posting (excluded from `npm test` — these publish for real)

Run these deliberately, with a real API key **from your own environment** — never
commit or paste a key. Both are omitted from `run-all.mjs`.

`post-live.test.mjs` — guarded single-platform publish. **Dry-run by default**;
sends nothing until `SOCIALPOST_CONFIRM=yes`. Prints the per-platform visibility
reality and the resulting permalink so you can delete a test post.

```bash
# Dry run — shows exactly what it would send, posts nothing:
SOCIALPOST_API_KEY=up_… SOCIALPOST_USER=<profile> node tests/post-live.test.mjs tiktok

# Real, private-by-default TikTok video (unaudited apps publish SELF_ONLY):
SOCIALPOST_API_KEY=up_… SOCIALPOST_USER=<profile> SOCIALPOST_MEDIA_FILE=./clip.mp4 \
  SOCIALPOST_CONFIRM=yes node tests/post-live.test.mjs tiktok
```

Knobs: `SOCIALPOST_TYPE` (text|photos|video, else inferred from the media file),
`SOCIALPOST_MEDIA_FILE` (comma-separate for a photo carousel), `SOCIALPOST_TITLE`,
`SOCIALPOST_BASE_URL`. Visibility per platform: TikTok = SELF_ONLY (private);
Facebook = use an Unpublished Page; LinkedIn = PUBLIC (delete after); Instagram =
PUBLIC (throwaway or delete after).

`post-course.test.mjs` — the original fixed scenario (LinkedIn + Facebook text).

```bash
SOCIALPOST_API_KEY=<key> node tests/post-course.test.mjs
```

`pages-live.test.mjs` — **read-only** live check (publishes nothing, no CONFIRM
gate). Asserts the Facebook Page list for a real connected account: pages array
shape, no leaked tokens, and that exactly one page is marked connected and
matches `connected_page_id`. Excluded from `run-all.mjs` because QA accounts have
no real Facebook connection.

```bash
SOCIALPOST_API_KEY=up_… SOCIALPOST_USER=<profile> node tests/pages-live.test.mjs
```

## Notes

- FFmpeg tests pass whether or not the `ffmpeg` binary is installed (they assert
  a real result **or** a clean 503 — never a faked success).
- Requires Node 18+ (global `fetch`/`FormData`/`Blob`).
