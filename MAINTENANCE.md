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

## Reminder

These are external-dependency drifts with no automated guard — LinkedIn
explicitly forbids "use latest by default," so the version can't be computed
safely. Keep this file's _Last reviewed_ date current when you check.
