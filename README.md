# TypeRacer Stats

[![Vercel](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftyperacer-stats.vercel.app&query=%24&label=Vercel&color=8B0000)](https://typeracer-stats.vercel.app)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-8B0000)](https://sirmastermind1379.github.io/typeracer-stats/)

> **Built with [opencode](https://opencode.ai)'s big-pickle free model**

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

## Release Notes (v1.1.0)

This release introduces several major features and refinements:

### What's New

- **CSV/ZIP import** — parse your race export via drag-and-drop or file picker (PapaParse + JSZip)
- **Wins chart** — dedicated wins-per-100 bar chart with independent trend line (excludes QOTD/solo races)
- **Data source management** — API data has priority; import hidden when API active; "Clear" button to reset
- **Nice axis ranges** — accuracy capped at 100 with clean integer ticks; speed/points auto-round
- **Auto-scroll** — page scrolls to profile after search or import completes
- **Server auto-restart** — PowerShell wrapper restarts dev server on crash

### Refinements

- Wins filtered out of speed/accuracy line chart into their own dedicated view
- Y-axis domains use clean rounded values for all metrics
- Import-only data hides the heatmap (no date context)
- "Race N" x-axis labels are used when race dates are invalid
- Side-by-side layout for SearchForm + DataImport on wider screens

### Built With

This release was built using **opencode**'s **big-pickle** free model.

## Future Considerations

- **Multi-universe support** — allow selecting different TypeRacer universes (play, comp, etc.)
- **Compare profiles** — side-by-side comparison of two or more racers
- **Race replay** — integrate keyboard heatmap / per-key analysis from keylog data
- **Export charts** — download chart as PNG/SVG for sharing
- **Leaderboard integration** — see where you rank among friends or globally
- **Session grouping** — group races into sessions by time gaps for per-session stats
- **Performance regression** — track WPM against text difficulty (text ID correlation)
- **Progressive Web App** — offline support via service worker for cached imports

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [JSZip](https://stuk.github.io/jszip/) — ZIP extraction

## License

MIT
