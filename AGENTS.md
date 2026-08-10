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

## Testing & Privacy Constraints
- **Browser Subagent QA**: Automatically run the `browser` subagent to test local applications (`http://localhost:1384`) after major iterations.
- **Credential Privacy**: NEVER write down or commit user API keys, passwords, or private tokens into persistent documentation or codebase files. Keep secrets strictly transient in chat memory.
