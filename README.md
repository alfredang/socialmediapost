# SocialPost 🛫

**One API call to post on every social platform.** A full-stack social media publishing platform — post videos, photos, text and documents to **22 networks** (TikTok, Instagram, YouTube, LinkedIn, Facebook, X, Threads, Pinterest, Reddit, Bluesky, Mastodon, Telegram, Discord, Slack, Dev.to, Hashnode, WordPress and more) from a single REST API, dashboard, SDK, or AI agent.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql) ![Docker](https://img.shields.io/badge/Docker-Coolify--ready-2496ED?logo=docker)

![SocialPost — landing page](screenshot.png)

## Features

- **One API call, every platform** — `POST /api/upload` (video), `/api/upload_video` (alias), `/api/upload_photos`, `/api/upload_text`, `/api/uploadposts/upload-document` (LinkedIn docs)
- **Auto-adapts content per platform** — grapheme-aware truncation (emoji count correctly 🚀), hashtags → first comment on Instagram, X weighted 280, per-platform `<platform>_title` overrides
- **Scheduling & automation** — ISO-8601 scheduling, per-profile posting queues (timezone, active days, slots), calendar (month/week/day), recurring **content pipelines**, in-process 30s scheduler
- **Analytics & metrics API** — followers/reach/impressions/engagement pulled from each platform's own API, time-series charts (Recharts), CSV export, per-post metrics
- **Whitelabel** — profiles API (`user` param), JWT connect-links so your customers link accounts under your brand
- **Full API management** — named API keys (hashed, shown once), request logging, per-plan quotas (429), FFmpeg processing quota, idempotency keys
- **Auth** — Google OAuth + email magic-link/OTP (passwordless), like modern SaaS
- **Admin instance settings** — an admin configures Google OAuth and SMTP at `/settings` without a redeploy; secrets are encrypted at rest and write-only in the UI, and any value set in the environment wins and shows read-only
- **AI copy assistant** — captions + hashtags (uses `ANTHROPIC_API_KEY` if set, offline heuristic otherwise)
- **Dark/light theme**, sidebar dashboard, notifications, team management, simulated billing with invoices

> **What's real:** fifteen of the 22 networks publish for real — Instagram, Facebook, LinkedIn, TikTok, YouTube and Threads over OAuth, plus Discord, Slack, Telegram, Bluesky, Dev.to, Hashnode, WordPress, Mastodon and Listmonk via a pasted credential. Every connected platform authenticates with a credential you can revoke on its own; the one platform-imposed caveat is surfaced rather than hidden — Hashnode's API requires a paid Pro plan on the publication. The remaining registry entries carry constraints/adaptation rules only and fail with a clear "integration is not yet available" rather than pretending to post. Analytics are collected from the Instagram, Facebook, TikTok and LinkedIn APIs — nothing is generated, and a metric a platform won't expose is stored as `NULL`, not `0`. Billing is still **simulated** (plan switches mint invoices without charging anything).

## Quick start

```bash
npm install

# Postgres connection string — required (Prisma targets postgresql).
export DATABASE_URL="postgresql://user:pass@localhost:5432/socialpost"

npx prisma db push          # applies the schema (this repo keeps no migrations)

# Optional bootstrap account — opt-in, and you supply the credentials.
# Without SEED_ADMIN_PASSWORD / SEED_ADMIN_API_KEY, random ones are printed once.
SEED_DEMO_DATA=true SEED_ADMIN_EMAIL=you@example.com npx prisma db seed

npm run dev                 # http://localhost:3000
```

**Sign in:** register with a password on `/login`, or use an email code — email sign-in needs `BREVO_API_KEY` or `SMTP_HOST` configured, since codes are only ever delivered by email.

**Configuring Google sign-in and SMTP:** register an account, promote it to admin, then open
`/settings` (avatar menu → Instance Settings) and paste the credentials — no redeploy needed.
The page is admin-only and returns 404 to everyone else, so the promotion has to happen first.

Set **`ADMIN_EMAIL`** to an address that has already registered and the container promotes it
on boot — no psql session against a database that isn't publicly reachable:

```bash
ADMIN_EMAIL=you@example.com      # promoted by docker-entrypoint.sh at startup
```

It's idempotent (safe to leave set across restarts) and never *creates* an account — register
the address first, or promotion is skipped. Outside Docker, run it directly:

```bash
ADMIN_EMAIL=you@example.com npx tsx prisma/promote-admin.ts
```

> Upgrading an existing install? The old seed wrote demo accounts (with credentials published in this repo), fake published posts and generated analytics into your database. `npx tsx prisma/purge-demo-data.ts` reports them; add `--apply` to remove them.

## The lead magnet

```bash
curl \
  -H 'Authorization: Apikey your-api-key-here' \
  -F 'video=@/path/to/your/video.mp4' \
  -F 'title="Your Awesome Title 🚀"' \
  -F 'user="your_profile_user"' \
  -F 'platform[]=tiktok' \
  -F 'platform[]=instagram' \
  -F 'platform[]=youtube' \
  -X POST http://localhost:3000/api/upload
```

Response: per-platform results with live post URLs. Add `scheduled_date` to schedule, `first_comment` for an auto first comment, `autogenerate=true` for AI copy.

## API surface

| Area | Endpoints |
|------|-----------|
| Upload | `POST /api/upload` · `/api/upload_video` · `/api/upload_photos` · `/api/upload_text` · `/api/uploadposts/upload-document` |
| Manage | `GET /api/uploadposts/status` · `GET /api/uploadposts/history` · `GET/PATCH/DELETE /api/uploadposts/schedule` |
| Queue | `GET/PUT /api/uploadposts/queue/settings` · `POST /api/uploadposts/add_to_queue` |
| Analytics | `GET /api/analytics/{profile}` · `GET /api/uploadposts/post-analytics/{id}` · `GET /api/uploadposts/platform-metrics` · `GET /api/uploadposts/media` |
| Whitelabel | `GET /api/uploadposts/me` · `POST/GET/DELETE /api/uploadposts/users` · `POST .../users/generate-jwt` · `GET .../users/validate-jwt` |
| Processing | `POST /api/uploadposts/ffmpeg/job` · `GET /api/uploadposts/ffmpeg/usage` |

Full docs with parameter tables live at **`/docs`** in the app.

## SDKs & integrations (`sdks/`)

| Package | What it is |
|---------|------------|
| [`sdks/python`](sdks/python) | Python SDK (`pip install -e sdks/python`) — `SocialPostClient` |
| [`sdks/node`](sdks/node) | Node.js SDK (zero-dependency, Node ≥18) — `socialpost-sdk` |
| [`sdks/n8n`](sdks/n8n) | n8n community node + credentials |
| [`sdks/vscode`](sdks/vscode) | VS Code extension — post a selection or file from the editor |
| [`sdks/mcp`](sdks/mcp) | MCP server — lets **GitHub Copilot, Claude, Cursor** post for you |

## Project structure

```
src/
  app/                    # Next.js App Router
    api/                  # Public API + auth + internal dashboard routes
    (dashboard)/          # users, upload, pipelines, calendar(+queue), history,
                          # analytics, api-keys, pricing, profile(+invoices),
                          # team, support, docs, connected-apps, comments, settings
    login/  connect/      # passwordless login · whitelabel connect page
    page.tsx              # landing page (curl lead magnet)
  lib/                    # platforms registry/adapters, publish engine, queue,
                          # scheduler, sessions, apikeys, plans, AI copy,
                          # settings resolver + secret-box encryption
  components/             # sidebar nav, theme toggle, platform icons, etc.
prisma/                   # schema + seed (no migrations — `prisma db push`
                          # applies the schema at container start), plus the
                          # promote-admin / purge-demo-data maintenance scripts
sdks/                     # python · node · n8n · vscode · mcp
tests/                    # functional suite + runner (see tests/README.md)
design-system/            # persisted UI design system (MASTER.md)
MAINTENANCE.md            # operational guardrails (e.g. host egress rules)
```

## Testing

The suite runs against a live dev server — each file self-provisions a throwaway
account and cleans up after itself.

```bash
npm run dev &    # start the server first
npm test         # runs tests/run-all.mjs
```

`npm test` covers auth, account, public API, queue/media, drafts, pipelines, authz,
quotas, dashboard sessions, webhooks, the SDKs, composer previews and platform
adapters. The real-posting scenario is deliberately excluded from the runner — run
`node tests/post-course.test.mjs` on its own when you actually want to publish to
LinkedIn + Facebook. See [tests/README.md](tests/README.md) for details.

## Acknowledgements

- Feature set inspired by multi-platform posting APIs; UI is an original design (dark-first, emerald "code" theme, Space Grotesk + JetBrains Mono)
- Built with [Next.js](https://nextjs.org), [Prisma](https://prisma.io), [Tailwind CSS](https://tailwindcss.com), [Recharts](https://recharts.org)

---

Powered by [Tertiary Infotech Academy Pte Ltd](https://www.tertiaryinfotech.com/)
