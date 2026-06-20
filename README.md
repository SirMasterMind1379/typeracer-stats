# TypeRacer Stats

[![Vercel](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftyperacer-stats.vercel.app&query=%24&label=Vercel&color=8B0000)](https://typeracer-stats.vercel.app)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-8B0000)](https://sirmastermind1379.github.io/typeracer-stats/)

| Deployment | URL | API Analysis | CSV Import |
|---|---|---|---|
| **Vercel** (live demo) | [typeracer-stats.vercel.app](https://typeracer-stats.vercel.app) | ✅ Full API | ✅ |
| **GitHub Pages** (static) | [sirmastermind1379.github.io/typeracer-stats](https://sirmastermind1379.github.io/typeracer-stats) | ❌ (static export) | ✅ |

View your TypeRacer historical stats — speed, accuracy, points, wins, and daily activity over time.

## Features

- **Historical race data** — speed (WPM), accuracy, points, and wins per 100 races
- **Interactive chart** — mouse-drag to select a timeframe; averages and stats update automatically
- **Multiple metrics** — toggle between speed, accuracy, cumulative points, and wins per 100 races
- **Regression trend lines** — see your learning rate (change per race and per 100 races) on speed and accuracy
- **Race limit filters** — filter to last 1000, 500, 200, 100, 50, or 20 races
- **Daily activity heatmap** — GitHub-style grid showing race count per day with red intensity gradient
- **Wins tracking** — separate wins-per-100 bar chart (excludes QOTD and solo races) with trend analysis
- **Streak counters** — daily streaks (any races + 10+ races/day) with evolving flame indicators
- **QOTD status** — shows whether you've completed the Quote of the Day competition
- **Dark/light mode** — persists preference in localStorage, respects system preference
- **API key optional** — enter your key for full race history, or leave blank for basic profile stats
- **CSV/ZIP import** — drag-and-drop your race export for offline analysis (GitHub Pages works too)
- **Data source priority** — API data takes precedence over file import; clear to switch sources

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Live Demo

[**https://typeracer-stats.vercel.app**](https://typeracer-stats.vercel.app)

### Static Site (GitHub Pages)

[**https://sirmastermind1379.github.io/typeracer-stats/**](https://sirmastermind1379.github.io/typeracer-stats/)

> Note: GitHub Pages is a static export — the API proxy is unavailable. Use the **CSV/ZIP import** feature to analyze your race data, or visit the Vercel deployment for full API support.

## Installation

```bash
git clone https://github.com/SirMasterMind1379/typeracer-stats.git
cd typeracer-stats
npm install
```

### Configuration

Copy the environment file and add your credentials:

```bash
cp .env.example .env.local
```

Optionally set your TypeRacer API key in `.env.local`:

```
TR_API_USERNAME=your_username
TR_API_KEY=your_api_key
```

Get your API key at https://data.typeracer.com/pit/api_keys

### Development

```bash
npm run dev
```

Open [http://localhost:1384](http://localhost:1384).

### Production

```bash
npm run build
npm start
```

## Release Notes

### v1.3.0 — Date format, slanted labels, heatmap overhaul

- **New date format** — all user-facing dates use `MMM/DD/YYYY` with 2-letter month abbreviations (JA, FE, MR, AP, MA, JN, JL, AG, SE, OC, NV, DE)
- **Slanted chart labels** — x-axis date labels slanted at -15° to prevent overlap; left margin added to avoid cutoff
- **Heatmap overhaul**:
  - Week-start date labels slanted at -30° above each column
  - All 7 weekday labels (Sun–Sat) shown on the left
  - 52-column grid aligned to Sun–Sat weeks, ending on upcoming Saturday
  - Future cells hidden (no empty blocks for unraced days)
  - Converted to CSS Grid layout for precise alignment
  - Centered within its container with proper date header row
- **Gradient legend** — centered below the heatmap
- **AGENTS.md** — documented preferences for date format, chart/heatmap styling, and heatmap grid behavior
- **html2canvas patched** — postinstall script prevents crash on oklch colors
- **dom-to-image-more** — replaced html2canvas for PNG export (native rendering, no oklch crash)
- **Export filenames** — dynamically include theme, metric, and race limit
- **Hydration fix** — inline flash-prevention script in `<head>`; dark mode state never read in SSR
- **QOTD countdown timer** — "Next QOTD in Xh Xm" below badge, updated every 30s from midnight UTC
- **Search/Refresh toggle** — button shows "Refresh" after search when fields unchanged
- **API key slide animation** — `grid-template-rows` transition with toggle below the field
- **UI gap standardization** — all vertical gaps set to `gap-2`

### v1.2.0 — QOTD fix, API key detection, grid layout

- **QOTD hidden** for non-API / scrape results (no false "Not Done")
- **Clear button** resets both username and API key fields
- **Auto-populate** username from CSV import and API response
- **API key in username field** auto-detected (32 alphanumeric chars) and moved to API key field
- **Grid layout** for balanced SearchForm / DataImport columns
- **GitHub link** button added in header
- **Profile link** regex now accepts `data.typeracer.com/pit/profile?user=...`

### v1.1.0 — CSV import, wins chart, axis refinements

- **CSV/ZIP import** — drag-and-drop or file picker (PapaParse + JSZip)
- **Wins chart** — dedicated wins-per-100 bar chart (excludes QOTD/solo races)
- **Data source management** — API priority; "Clear" button to reset
- **Nice axis ranges** — accuracy capped at 100 with clean integer ticks
- **Auto-scroll** to profile after search or import
- **Server auto-restart** script

### Credits

- **v1.1.0 onward** built with [opencode](https://opencode.ai)'s **big-pickle** free model
- **v1.0.0 and earlier** built with **DeepSeek V4 Flash low mode**

## Future Considerations

- **Session grouping** — group races into sessions by time gaps for per-session stats
- **User script / browser extension** — real-time stats tracking overlay on play.typeracer.com using the existing API proxy and import logic

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [JSZip](https://stuk.github.io/jszip/) — ZIP extraction
- [dom-to-image-more](https://github.com/tsayen/dom-to-image-more) — chart / heatmap PNG export (replaced html2canvas)

## License

MIT
