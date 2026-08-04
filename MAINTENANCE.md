# Maintenance

Recurring upkeep that isn't caught by tests, the type-checker, or CI — mostly
**external API version pins** that vendors sunset on their own schedule. A stale
pin fails at runtime against the live platform (never in `npm test`, which never
calls a real platform), so review these roughly once a year.

_Last reviewed: 2026-07._

## External API version pins

| What | Where | Current value | Vendor policy | Action |
|------|-------|---------------|---------------|--------|
| **LinkedIn API version** | [src/lib/linkedin.ts](src/lib/linkedin.ts) `LI_VERSION` | `202607` | Monthly releases; each supported **min. 1 year**, then hard-sunset | **Bump annually.** A stale pin fails with `Requested version <YYYYMM>01 is not active`. Latest list: <https://learn.microsoft.com/linkedin/marketing/versioning> |
| **Facebook Graph API** | [src/lib/facebook.ts](src/lib/facebook.ts) `GRAPH` + OAuth dialog | `v21.0` | Quarterly releases; deprecated ~2 years after release | Review yearly; bump the version in both the `graph.facebook.com` base and the `facebook.com/<v>/dialog/oauth` URL together. |
| **Instagram Graph API** | [src/lib/instagram.ts](src/lib/instagram.ts) `GRAPH` | `v21.0` | Same as Facebook (Meta Graph) | Review yearly, alongside Facebook. |
| **Anthropic model ID** | [src/lib/ai.ts](src/lib/ai.ts) | `claude-haiku-4-5-20251001` | Dated model snapshots are eventually retired | Review yearly; move to the current snapshot when the pinned one is deprecated. |

## OAuth scopes → require reconnect + App Review

When a scope is **added** to a platform's OAuth request, existing connections
keep their old token and must **reconnect** to gain it. Advanced permissions
also need vendor **App Review** before non-admin/non-tester users can grant them.

| Platform | Scopes | Notes |
|----------|--------|-------|
| Facebook | [src/lib/facebook.ts](src/lib/facebook.ts) `SCOPES` | `pages_read_user_content` + `pages_manage_engagement` (comment read/reply) are advanced → App Review. |
| Instagram | [src/lib/instagram.ts](src/lib/instagram.ts) `SCOPES` | `instagram_business_manage_comments` (comment read/reply) is advanced → App Review. |

## Database: `db push` now, migrations before launch

The schema is applied declaratively: [docker-entrypoint.sh](docker-entrypoint.sh)
runs `prisma db push --accept-data-loss` on boot, which reshapes the DB to match
[prisma/schema.prisma](prisma/schema.prisma) directly. There is intentionally no
`prisma/migrations/` folder — while the schema is still moving and there's no
real data, declarative push is the single source of truth (a parallel migration
history would only drift and mislead).

**Guardrail — switch before the first real user data lands.** `db push
--accept-data-loss` will DROP columns/tables to match the schema; harmless on an
empty DB, destructive once there are real rows. Before launch:

1. `prisma migrate dev --name init` to generate one clean baseline migration from
   the current schema.
2. Change the entrypoint from `prisma db push --accept-data-loss` to
   `prisma migrate deploy`.
3. Drop `--accept-data-loss`.

From then on, schema changes ship as reviewable, reversible migrations that never
silently delete production data.

## Host egress hardening (not in this repo)

**Status: NOT applied as of 2026-08.** Recorded here because it is host state —
invisible to the code, and it silently disappears on a server rebuild or
migration, at which point nothing in a code review would reveal the safety net
is gone.

The app fetches URLs supplied by callers (`media_url`, and the WordPress /
Mastodon / Listmonk instance URLs). [src/lib/safe-fetch.ts](src/lib/safe-fetch.ts)
gates every one: scheme allowlist, DNS resolution checked against private
ranges, and per-hop redirect re-validation.

**That guard has a residual gap it cannot close on its own.** It resolves the
hostname, validates the addresses, then hands `fetch()` a *hostname* — which
resolves again. An attacker serving TTL-0 records can return a public address to
the check and a private one to the fetch (DNS rebinding). Closing it in code
means pinning the validated IP for the connection, which needs either `undici`
as a dependency or rewriting `safeFetch` on `node:https`.

A host firewall rule closes the *consequence* rather than the race, protects
every future SSRF sink, and holds even when the app's checks are wrong:

```bash
sudo iptables  -I DOCKER-USER -d 169.254.0.0/16 -j DROP
sudo ip6tables -I DOCKER-USER -d fe80::/10      -j DROP
sudo apt install iptables-persistent && sudo netfilter-persistent save
```

- `DOCKER-USER` is the one chain Docker never flushes, so it survives container
  recreation and Docker daemon restarts. It does **not** survive a reboot
  unless persisted — hence the third line.
- Link-local is the highest-value target (cloud metadata: instance credentials,
  SSH keys, user-data) and **nothing in this app uses it**, so the rule is
  safe by inspection. Postgres is on a different range and is unaffected.
- Cannot lock you out of SSH: it filters `FORWARD` (container → outside) by
  destination, while SSH arrives on the public IP via `INPUT`.

Verify before and after — the first should start failing, the others must keep
working:

```bash
docker exec <container> wget -qO- --timeout=3 http://169.254.169.254/ ; echo "exit=$?"
docker exec <container> nslookup graph.instagram.com
docker exec <container> wget -qO- --timeout=5 https://graph.instagram.com/ >/dev/null; echo "outbound=$?"
```

**Do not** extend this to a blanket RFC1918 deny without first allowing the
database. `iptables -I` inserts at the top, so the allow rule must be added
*after* the deny to end up *above* it; get the order wrong and the app loses
Postgres. The link-local rule alone needs no allowlist, which is why it is the
one recommended here.

Revisit the code-level fix before: real customer data lands, the app moves to a
provider whose metadata serves IAM credentials (AWS without IMDSv2 enforced), or
another endpoint starts fetching user-supplied URLs.

## Reminder

These are external-dependency drifts with no automated guard — LinkedIn
explicitly forbids "use latest by default," so the version can't be computed
safely. Keep this file's _Last reviewed_ date current when you check.
