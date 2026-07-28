---
description: Securely commit & push code to GitHub — scans for secrets/keys first (blocking), commits with this repo's conventions, pushes (branching off main when needed), and optionally opens a PR. If this repo is wired to a Coolify app, pushing to main auto-redeploys production.
argument-hint: "[pr]"
allowed-tools: Bash, Grep, Read, Glob
---

# /git-push

Securely ship code changes to GitHub.

**Deploy note:** this app deploys via **Coolify** (see [Dockerfile](../../Dockerfile) + [docker-entrypoint.sh](../../docker-entrypoint.sh)). If the Coolify app is connected to this repo, a push to **`main`** triggers a production redeploy — and the entrypoint runs `prisma db push --accept-data-loss` on boot, so schema changes ship live immediately. Treat a push to `main` as a production deploy.

**Argument:** pass `pr` (in `$ARGUMENTS`) to also open a pull request after pushing.

## Phase 1 — Secret scan (MANDATORY, blocking)

Never push secrets. Scan what's about to go up **before** any git write.

> Use the **Grep tool (ripgrep)** for pattern scanning — do NOT shell out to `grep` (Windows + Git Bash/PowerShell box; the Grep tool is the reliable path).

1. List what's staged: `git diff --cached --name-only`. If nothing is staged yet, scan the files you intend to stage.
2. **Block sensitive files outright** — if any of these are staged, STOP: `.env`, `.env.*` (any env file except `.env.example` with placeholder values), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`/`id_ed25519`, `credentials.json`, `secrets.json`, `.npmrc`, `.netrc`, anything under `certificates/`, and `prisma/dev.db` / `*.db` (the dev database contains hashed keys and seeded accounts).
3. **Scan staged file contents** with the Grep tool. Run patterns as separate searches so one noisy hit doesn't hide others:
   - **This repo's own secrets (hard stops)** — a real value assigned to any of:
     - `SESSION_SECRET\s*=\s*\S`, `COOLIFY_API_KEY\s*=\s*\S`, `BREVO_API_KEY\s*=\s*\S`, `SMTP_PASS\s*=\s*\S`
     - `INSTAGRAM_CLIENT_SECRET\s*=\s*\S`, `GOOGLE_CLIENT_SECRET\s*=\s*\S`
     - `postgres(ql)?://[^\s"']*:[^\s"'@]+@` — a Postgres URL **with credentials** (`DATABASE_URL`)
     - `sk-ant-` — Anthropic keys (`ANTHROPIC_API_KEY` is a legit runtime env var for the AI copy assistant, but the key value must never appear in a committed file)
   - **Generic credential assignments:** `(api[_-]?key|api[_-]?secret|secret|password|passwd|token|credential)\s*[:=]\s*['"][^'"]{8,}['"]` — a literal secret assigned in code. (Ignore obvious test/demo fixtures like the seeded `demo1234` in [prisma/seed.ts](../../prisma/seed.ts) and API-doc examples like `your-api-key-here`.)
   - **Private keys:** `-----BEGIN (RSA|DSA|EC|OPENSSH|PGP)? ?PRIVATE KEY-----`.
   - **Vendor keys:** AWS `AKIA[0-9A-Z]{16}`; Google `AIza[0-9A-Za-z\-_]{35}`; Stripe `sk_live_`, `rk_live_`; Slack `xox[baprs]-`; GitHub `gh[pousr]_[A-Za-z0-9_]{36,}`; SendGrid `SG\.`; Brevo `xkeysib-`.
   - **JWTs / bearer tokens:** `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`, `bearer\s+[A-Za-z0-9._\-]{20,}` — but note this repo's docs/tests legitimately contain **example** JWT/`Apikey` strings; only flag ones that decode to real-looking payloads or aren't clearly fixtures.
4. **`.gitignore` sanity:** confirm `.env` / `.env*` are ignored (they are, at the bottom of [.gitignore](../../.gitignore)) and stay that way.

**If anything is found:** STOP. Report each hit as `file:line`, remediate — move the value to `.env` and read it via `process.env.X`, then `git restore --staged <file>` to unstage. Never commit a real secret "temporarily."

**If clean:** report "🔒 Secret scan clean — no secrets staged" and continue.

## Phase 2 — Commit & push

1. `git status` and `git diff --cached --stat` to confirm exactly what's going up.
2. **Stage explicitly** — list the files and `git add <paths>`. Never `git add -A` / `git add .` (it sweeps in stray files, `uploads/`, and secrets).
3. **Branch policy:** if on `main` and the user hasn't explicitly said to commit to `main`, create a feature branch first (`git switch -c <type>/<short-topic>`). Remember pushing `main` may be a production deploy.
4. **Commit message:** conventional commits — `feat: …`, `fix: …`, `docs:`, `refactor:`, `chore:` — matching the existing history (`feat: PostgreSQL + Docker deployment (Coolify-ready)`). End with the trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
   (No interactive flags — no commit editor, no `git rebase -i`; they hang in this environment.)
5. **Push:** `git push origin <branch>` (`-u` on a new branch). If rejected non-fast-forward: `git pull --rebase origin <branch>` then push again. Never `--force` unless the user explicitly asks.

## Phase 3 — Pull request (only if `pr` in `$ARGUMENTS` or the user asks)

```bash
gh pr create --title "<conventional title>" --body "## Summary
- <what changed and why>

## Test plan
- [ ] npm run build passes
- [ ] node tests/post-course.test.mjs (with dev server running)
- [ ] smoke-tested the affected route(s) on http://localhost:3000 (api-tester agent for API routes)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Target `main` unless told otherwise. Report the PR URL.

## Phase 4 — Report

Summarize: branch, commit hash + subject, push result, PR URL (if any), and **whether this deploys** — if pushed to `main` with Coolify wired, note "→ Coolify will auto-redeploy production (entrypoint re-runs `prisma db push` + seed)."
