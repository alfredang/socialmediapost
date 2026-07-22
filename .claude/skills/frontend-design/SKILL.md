---
name: frontend-design
description: Project-locked frontend design skill for SocialPost. Enforces the developer-tool aesthetic used across the landing page, login, and dashboard — emerald #22c55e primary, Space Grotesk UI type + JetBrains Mono for code/terminal elements, light AND dark themes (every page must work in both), rounded-lg/xl cards, top-navbar dashboard, SVG icons, terminal-style code blocks with Copy buttons. Use whenever building or restyling any page or component in this repo.
---

# SocialPost — Developer-Tool Aesthetic

This skill is locked to ONE design direction: a clean **API developer portal** — think Stripe/Vercel docs energy with an emerald "code" accent. A developer should feel they're using a serious tool with a terminal soul. Do not invent new palettes, fonts, or moods.

## Sources of truth, in priority order

1. `design-system/socialpost/pages/<page>.md` — per-page overrides, **if present**.
2. [design-system/socialpost/MASTER.md](../../../design-system/socialpost/MASTER.md) — spacing scale, shadows, component specs.
3. [src/app/globals.css](../../../src/app/globals.css) + existing pages — **the shipped code wins on any conflict**. Known drift: MASTER.md says JetBrains Mono for headings *and* body, but the app actually uses **Space Grotesk** (`--font-grotesk`) for UI text and **JetBrains Mono** (`--font-jbmono`) only for code/terminal/data elements. Follow the code.
4. The `ui-ux-pro-max` skill's priority table (accessibility ≥ touch ≥ performance ≥ style).

After building or restyling a page, run the **design-reviewer** agent.

## Design tokens (LOCK these)

- **Primary/CTA**: emerald — `--color-primary: #22c55e` in globals.css. Buttons: `bg-emerald-600 hover:bg-emerald-500 text-white` (or `bg-emerald-500` on dark surfaces). Tints: `bg-emerald-50` (light) / `bg-emerald-950` (dark) with matching `text-emerald-700` / `text-emerald-300`.
- **Neutrals**: slate/gray scale. Light theme: white/gray-50 surfaces, `text-slate-900` headings, `text-slate-600` body. Dark theme: near-black slate surfaces (`slate-900/950`), `text-slate-100` headings, `text-slate-400` body.
- **Status colors**: green Success / red Failed / amber Pending — always pill + text label, never color alone.
- **No off-palette colors** — no indigo, no random blues/purples. Platform brand colors live only in platform icons.

## Typography

- **UI text** (headings, body, buttons, nav): `var(--font-grotesk)` (Space Grotesk) — the default `font-family` on body; no class needed.
- **Code / terminal / data** (curl blocks, API keys, endpoints, tokens, tabular numbers): `font-mono` → JetBrains Mono. This is the personality font — the landing curl block, docs endpoints, and API-key displays all use it.
- Never import other Google Fonts; both fonts are wired in [src/app/layout.tsx](../../../src/app/layout.tsx) via `next/font`.

## Required visual language

1. **Both themes, always** — every `bg-*`/`text-*`/`border-*` class gets a `dark:` counterpart (or inherits one). A page that only works in one theme is a defect. Contrast ≥ 4.5:1 for body text in both.
2. **Cards**: `rounded-xl border shadow-sm` (the repo convention is `rounded-lg`/`rounded-xl`, not `2xl`) — `border-slate-200 dark:border-slate-800`, `bg-white dark:bg-slate-900`.
3. **Buttons**: primary = emerald pill/rect with `cursor-pointer` and a `focus-visible` ring; secondary = bordered neutral (`border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800`).
4. **Code blocks**: dark slate background in BOTH themes (a terminal is dark even in light mode), `font-mono`, with a Copy button.
5. **SVG icons, not emoji** — chrome/nav/buttons use SVG (see `src/components/` platform icons). Emoji only where content itself is playful (e.g. the 🛫 brand mark).
6. **Forms**: visible labels, inline errors, helper text under the field. Inputs `rounded-lg border` with emerald focus ring.
7. **Tables**: horizontal scroll inside their own `overflow-x-auto` container on mobile — the page never scrolls sideways.
8. **Motion**: 150–300ms transitions on hover/focus. Subtle — this is a tool, not a toy. No scroll-jacking.

## What NOT to do (bans)

- ❌ Indigo or any non-emerald primary (a stale spec mentioned indigo — it was never shipped).
- ❌ Single-theme styling — missing `dark:` variants.
- ❌ `gray-400` body text on white (fails contrast).
- ❌ JetBrains Mono for body paragraphs, or any new font imports.
- ❌ Emoji as functional icons in dashboard chrome.
- ❌ Light-background code blocks.

## When invoked

1. Check `design-system/socialpost/pages/` for a page-specific spec; else follow MASTER.md + this skill.
2. Build with the token set above; write light + `dark:` classes together, not as an afterthought.
3. Reference existing pages for patterns: landing ([src/app/page.tsx](../../../src/app/page.tsx)), login, and the `(dashboard)` clients (api-keys, analytics, calendar) are the canon.
4. Stress-test at 375px: tap targets ≥ 44px, tables scroll internally, nav collapses cleanly.
5. Finish by running the **design-reviewer** agent on the touched pages.