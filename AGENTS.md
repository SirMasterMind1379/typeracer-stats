<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands
- `npm run dev` — start dev server
- `npm run build` — typecheck + production build
- `npm run lint` — run ESLint

## Date Format Preference
All user-facing dates must use the format `MMM/DD/YYYY` where `MMM` is a 2-letter uppercase abbreviation:
JA (Jan), FE (Feb), MR (Mar), AP (Apr), MA (May), JN (Jun), JL (Jul), AG (Aug), SE (Sep), OC (Oct), NV (Nov), DE (Dec)

Example: `MR/15/2026` for March 15, 2026.
The helper `formatDisplayDate()` in `app/components/types.ts` implements this. Use it wherever a date is displayed on the frontend. Do **not** change backend date handling or CSV export date formatting.

## Chart & Heatmap Date Labels
- X-axis date labels on charts should be slanted (`angle: -15`, `textAnchor: "end"`) to prevent overlap. Add `margin={{ left: 12, bottom: 30 }}` on the chart container and `height={40}` + `padding={{ left: 10 }}` on XAxis to prevent the leftmost label from being cut off.
- Heatmap week-start labels (Sunday of each week) should use the same `MMM/DD/YYYY` format angled at `-30deg` with `transformOrigin: "top left"` (slants top-left→bottom-right), positioned above each column. Show all 7 weekday labels (Sun–Sat) on the left side. The grid must always be exactly 52 columns (Sun–Sat weeks), ending on the upcoming Saturday, with future cells hidden.

