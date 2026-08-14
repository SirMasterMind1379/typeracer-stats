<!-- BEGIN:antigravity-agent-rules -->
# Antigravity Agent Rules — TypeRacer Stats V2

This codebase uses **Pure Vanilla TypeScript**, **Vite 6**, and native **`Bun.serve`** API proxying. Do NOT introduce React, Next.js, or heavy UI framework dependencies unless explicitly requested.

<!-- END:antigravity-agent-rules -->

## Development Commands
- `npm run dev` — Start Vite dev server on port 1384 (`npx vite --port 1384`)
- `bun run server.ts` — Start native Bun API proxy server on port 1385
- `npm run build` — Typecheck and build production bundle (`tsc && vite build`)

## Date Format Preference
All user-facing dates MUST use the format `MMM/DD/YYYY` where `MMM` is a 2-letter uppercase month code:
- `JA` (Jan), `FE` (Feb), `MR` (Mar), `AP` (Apr), `MA` (May), `JN` (Jun), `JL` (Jul), `AG` (Aug), `SE` (Sep), `OC` (Oct), `NV` (Nov), `DE` (Dec)

Example: `MR/15/2026` for March 15, 2026.  
The helper `formatDisplayDate()` in `src/types.ts` implements this. Use it wherever a date is displayed on the UI. Do **not** alter raw backend API responses or CSV export date formats.

## Chart & Heatmap Visual Invariants
- **SVG Chart Date Labels**: X-axis date labels on charts MUST be slanted at `-15°` (`transform="rotate(-15, ...)"`, `text-anchor="end"`) to prevent label overlap.
- **Activity Heatmap Date Headers**: Week-start date labels (Sunday of each week) MUST use `MMM/DD/YYYY` angled at `-30deg` with `transform-origin: bottom left`, positioned above each column. All 7 weekday labels (Sun–Sat) must be shown on the left. The grid must remain exactly 52 columns ending on the upcoming Saturday, with future cells hidden.

## Git & Deployment Workflow Policy
- **No Unsolicited Git Pushes / Vercel Checks**: Do NOT run `git push`, push changes to GitHub, or perform Vercel web app deployment checks unless explicitly asked by the user, or when `/git-release` is invoked. Keep routine work focused strictly on local file edits and local verification (`http://localhost:1384`).
- **Relative Base Path (`base: './'`)**: Always maintain `base: './'` in `vite.config.ts` so bundled HTML assets use relative paths (`./assets/...`), ensuring 100% compatibility across both GitHub Pages subpaths and Vercel root URLs.
- **CI Runner Standard**: Maintain `node-version: 22` in `.github/workflows/deploy.yml` and keep `package-lock.json` synchronized via `npm install`.

## Windows Vite 6 & Tailwind v4 CSS Handling
- **No PostCSS Files**: Do NOT create `postcss.config.*` files or add `"postcss"` keys to `package.json`. Tailwind CSS v4 is handled natively via `@tailwindcss/vite`.
- **Server Cache Clear**: If Vite dev server caches PostCSS error handles on Windows, terminate the running Vite dev server task before launching a fresh dev server instance.

## Data Fetching & QOTD Invariants
- **Pit History Scraper Fallback (1,000+ Races)**: TypeRacer's JSON API caps at 1,000 races. Backend handlers (`server.ts`, `api/user-stats.ts`) MUST automatically call `scrapeHistoryPages(username, 11, 25)` (`https://data.typeracer.com/pit/race_history?user={username}&n=100&p={page}`) whenever the primary API returns 1,000 races, ensuring 100% of all lifetime races (1,459+) are loaded into IndexedDB.
- **QOTD Daily Reset Timestamp Calculation**: Daily QOTD resets at **00:00 UTC** (8:00 PM EDT). Always calculate `today00UTC` (`Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())`). `qotdDone` MUST ONLY evaluate to `true` if a QOTD race or competition result occurred **after `today00UTC`**. Do NOT rely on permanent profile badges.
- **Zero-Filter Race Preservation**: NEVER filter out valid races (`speed > 0`). Retain all races (multiplayer, practice, solo, QOTD), tag each race with its mode, and permit mode filtering exclusively via UI controls (`All Races`, `Multiplayer`, `Practice`, `QOTD`).

## Theme & UI Component Invariants
- **Auto-Theme & System Preference**: Theme mode MUST default to `"auto"` for new users to match OS and browser `prefers-color-scheme`. The toggle button MUST cycle `AUTO` ➔ `LIGHT` ➔ `DARK` ➔ `AUTO`. Dynamic listeners on `window.matchMedia("(prefers-color-scheme: dark)")` MUST update the app in real time when system theme changes in auto mode.
- **Tailwind v4 Theme Token Declarations**: Custom Tailwind v4 color variables MUST be explicitly declared under `@theme` in `src/index.css` (e.g., `--color-beige-950: #161214`). Never reference undeclared theme color tokens, as missing variables evaluate to transparent/white backgrounds in dark mode.
- **In-Place Structural Skeleton Loading**: When `loading === true`, the application MUST render structural skeleton placeholders in the exact visual layout positions of all dashboard components (Profile, Stats Cards, Controls, Chart, Heatmap, Race Table, Mode Breakdown, Pokédex Grid). Do NOT append generic loader boxes at the bottom.
- **Component UI State Preservation Across Theme Toggles**: Component local state (such as `TextCollectorState` with `isPokedexView` and `selectedQuoteId`) MUST be persisted across `render()` calls so theme switches do NOT reset active views or close open detail drawers.

## Extension & Manifest V3 Engineering Rules
- **Icon Binary Header Alignment**: Icon declarations in `manifest.json` MUST match the exact binary format of the underlying image asset (`.jpg` for JPEG binaries).
- **CORS Delegation via Service Worker**: Content scripts running in page context MUST delegate cross-origin network requests (`data.typeracer.com`) to `background.js` via `chrome.runtime.sendMessage()`.
- **Uncapped Streak Data Querying**: Streak calculation helper functions MUST query up to 200 recent items before filtering competitive races to ensure accurate daily totals without artificial capping.
- **React/Next.js DOM Mutation Safety**: NEVER move or re-parent TypeRacer's React DOM nodes via `appendChild()` or `insertBefore()`. Perform all layout adjustments strictly using **Pure CSS** (`:has()`, flexbox, CSS grid) to prevent React `removeChild` reconciliation crashes.
- **Independent Window State Persistence**: Floating coordinates/dimensions (`position`, `dimensions`) MUST be stored independently from snapped sidebar width (`dockedWidth`). Undocking must restore floating size, and snapping must restore docked sidebar width.
- **16px Dock Margin Gutter Invariant**: When window snapping is active, website body margins and width constraints MUST include a 16px breathing gap (`calc(var(--tr-dock-width) + 16px)`) so site elements never press flush against the extension border.
- **Instant Cached Data Rendering on Reload**: Always save the active username to `localStorage.getItem("tr_username")` and synchronously render cached race and streak data from `localStorage`/`IndexedDB` on initial boot before awaiting async background network sync.
- **Unified ExtensionRace Field Invariant**: All extension modules MUST consistently use `wpm` (1-decimal), `timestamp` (ms epoch), `dateStr` (`formatDisplayDate(timestamp)`), and `textId`, avoiding legacy `speed` or `date` fields.

## Testing & Privacy Constraints
- **Browser Subagent QA**: Automatically run the `browser` subagent to test local applications (`http://localhost:1384`) after major iterations.
- **Credential Privacy**: NEVER write down or commit user API keys, passwords, or private tokens into persistent documentation or codebase files. Keep secrets strictly transient in chat memory.
