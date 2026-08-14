# ⌨️ TypeRacer Stats V2 (v2.3.0)

> **Production-Grade TypeRacer Analytics, Web Dashboard & Live Stats Overlay Extension**  
> Built with Pure Vanilla TypeScript, Vite 6, Tailwind CSS v4, and Native API Proxying. Zero heavy UI frameworks.

[![Live Demo on Vercel](https://img.shields.io/badge/Vercel_Deployment-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://typeracer-stats.vercel.app)
[![Live Demo on GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live_Demo-222222?style=for-the-badge&logo=github&logoColor=white)](https://sirmastermind1379.github.io/typeracer-stats/)
[![Release v2.3.0](https://img.shields.io/badge/Release-v2.3.0-800000?style=for-the-badge)](https://github.com/SirMasterMind1379/typeracer-stats/releases/tag/v2.3.0)

---

### 🌐 Try the Live Web Deployments

- 🚀 **Vercel Deployment (Full Serverless Proxy & Scraper)**: [https://typeracer-stats.vercel.app](https://typeracer-stats.vercel.app)
- ⚡ **GitHub Pages Deployment**: [https://sirmastermind1379.github.io/typeracer-stats/](https://sirmastermind1379.github.io/typeracer-stats/)

---

## 🧩 TypeRacer Stats Overlay Extension (v2.3.0)

A lightweight, zero-framework Chrome Extension (Manifest V3) & Tampermonkey Userscript that provides an in-game live overlay on `play.typeracer.com`.

### 🌟 Key Extension Features:
- **📊 Multiplayer Progression Sparkline**: Interactive SVG line chart of your last 10 races with linear regression trendlines (`▲ +X.X WPM` / `▼ -X.X WPM`), dynamic bounds, and direct pit result links.
- **🔥 Daily 10-Race Streak & QOTD Tracker**: Real-time progress bar counting towards your 10 daily multiplayer races resetting at **00:00 UTC**, live countdown timer, and automatic Quote of the Day completion status.
- **🔁 Live Quote Recognition & Performance Delta**: Pre-race recognition indicating first-time encounter vs repeat quotes with past best speed. Post-race delta pill (`🚀 +5.2 WPM vs previous attempt`).
- **🪟 Smart Window Docking & Snapping**: Drag to left/right screen edges to snap into a side-docked layout with automatic **16px natural breathing gutters** and real-time site resizing (`--tr-dock-width`). Floating and docked window dimensions/positions are **saved independently**.
- **🏎️ TypeRacer Wide Track Mode**: Expands racetrack containers across full available screen space without clipping under docked sidebars.
- **🧹 Site Cleaners & Optimizations**:
  - **Hide Premium Upsells & Ads** (protecting theme dialogs)
  - **Hide Social Links** inside the main race card
  - **Auto-Hide Top Navigation Bar** (reveals on hover)
  - **Hide Mouse Cursor While Typing**
  - **Block Racer Hover Popups During Race**
- **⚡ Instant Cache Boot**: Renders user stats and streak data from `localStorage`/`IndexedDB` in `<1ms` on browser reload before async background syncing.

### 📦 Extension Installation:
1. Run `npm run build` to generate the extension bundle at `dist/extension`.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist/extension` folder.
5. Visit [play.typeracer.com](https://play.typeracer.com) and start typing!

*Userscript format is also generated automatically at `dist/userscript/typeracer-overlay.user.js` for Tampermonkey/Violentmonkey.*

---

## ✨ Web Dashboard Features & Highlights

- **⚡ Zero-Framework Architecture**: High-performance pure DOM TypeScript rendering under 72KB gzipped bundle.
- **🔄 Auto-Theme & System Preference**: Defaults to `"auto"` mode catching browser/OS `prefers-color-scheme`. 3-way toggle button (`💻 AUTO` ➔ `☀️ LIGHT` ➔ `🌙 DARK`) with real-time OS preference change listeners.
- **🕹️ Text Collector & Pokédex View**: Matrix grid displaying all encountered vs unconquered quote text IDs with state persistence across theme toggles.
- **📈 Repeat Progression Sparkline**: Interactive dual-line SVG micro chart (`WPM` red line & `Accuracy %` emerald line) for quotes typed 2x or more.
- **🦴 In-Place Structural Skeleton Loading**: Animated layout skeletons rendered in exact component positions while fetching multi-batch historical race data.
- **🕷️ Pit History Scraper Fallback (1,000+ Races)**: Automatically scrapes TypeRacer pit race history pages when the API returns 1,000 races, capturing 100% of all lifetime races (1,459+).
- **🎯 Precision Analytics & Mode Breakdown**: Per-mode speed, accuracy (formatted to 2 decimals), win rates, trend calculations, and uniform orange `QOTD` badges.
- **📊 Interactive SVG Charts**: Progressive polyline draw, rotated date ticks (`-15°`), crosshairs, tooltips, and timeframe drag-to-zoom.
- **📅 52-Week Activity Heatmap**: GitHub-style calendar grid ending on the upcoming Saturday with angled Sunday date headers (`-30°`) and daily race intensity tooltips.
- **⚡ IndexedDB Fast Cache**: Privacy-gated local storage (`typeracer_db`) for zero-latency instant reloads when credentials are provided.
- **🔒 API Key Privacy Guard & Saved Credentials**: Secure cookie persistence with password eye toggle, credential reload drawer, and strict privacy boundaries.
- **📥 Export Options**: Export charts as PNG images (`dom-to-image-more`) or download complete raw race logs as CSV files.

---

## 🚀 Quickstart & Development Setup

### Prerequisites
- Node.js 22+ & npm
- [Bun](https://bun.sh) (optional, for native local API server)

### Installation
```bash
git clone https://github.com/SirMasterMind1379/typeracer-stats.git
cd typeracer-stats
npm install
```

### Running Locally
```bash
# Start Frontend Dev Server (Port 1384)
npm run dev

# Start Native Bun API Proxy Server (Port 1385)
npm run api
```

### Production Build
```bash
npm run build
```

---

## 🌐 Deployment Guide

### Option 1: Vercel (Recommended)
This repository includes a ready-to-deploy Vercel Serverless Function setup (`api/user-stats.ts` and `vercel.json`).

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Vercel automatically detects the Vite build (`npm run build`) and routes `/api/*` requests to the serverless function handler. Zero server configuration required!

### Option 2: GitHub Pages (Static Host)
The repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. Enable GitHub Pages in your repository settings: **Settings > Pages > Source: GitHub Actions**.
2. Whenever you push to `main` or publish a version tag (e.g. `v2.3.0`), GitHub Actions automatically builds and deploys the static application using relative base paths (`base: './'`).

---

## 📐 Project Structure

```
├── api/
│   └── user-stats.ts       # Vercel Serverless Function & Pit Scraper handler
├── extension/              # TypeRacer Stats Overlay Extension & Userscript
│   ├── src/
│   │   ├── core/           # QuoteStore, StreakTracker, Notifier, TypeRacerHook
│   │   ├── overlay/        # OverlayUI, RecentRacesWidget, StreakWidget, QuoteHistoryWidget
│   │   ├── styles/         # Pure Shadow DOM overlay stylesheet (overlay.css)
│   │   ├── background.ts   # Manifest V3 Service Worker (CORS Proxy & Alarms)
│   │   ├── content.ts      # Main Content Script & Dynamic Pure CSS Layout Injector
│   │   └── types.ts        # Extension Interfaces & Date Formatter
│   ├── manifest.json       # Chrome Manifest V3 declaration
│   └── build.js            # esbuild bundler for Extension & Userscript
├── src/
│   ├── components/         # Modular Pure TS UI Components
│   │   ├── ActivityHeatmap.ts
│   │   ├── Chart.ts        # Interactive SVG Chart with Drag Zoom & Tooltips
│   │   ├── CsvExportButton.ts
│   │   ├── DataImport.ts
│   │   ├── ErrorBanner.ts
│   │   ├── ExportButton.ts
│   │   ├── Header.ts       # Auto-Theme 3-Way Toggle & Navigation Header
│   │   ├── ModeComparison.ts # Per-Mode Performance Metrics & Precision Formatting
│   │   ├── RaceTable.ts    # Sortable & Filterable Race Table (Default 10/page)
│   │   ├── SearchForm.ts   # Credential Form & Cookie Memory
│   │   ├── StatsCards.ts
│   │   ├── TextCollector.ts# Text Collector Pokédex & SVG Repeat Sparklines
│   │   ├── TimeframeStats.ts
│   │   └── UserProfile.ts  # Profile Card & QOTD Status Badges
│   ├── db.ts               # IndexedDB Storage Engine (typeracer_db)
│   ├── index.css           # Tailwind v4 Configuration & Red Velvet Theme Tokens
│   ├── main.ts             # App State Machine, Skeleton Layout & Render Loop
│   └── types.ts            # TypeScript Models & Date Helpers (MMM/DD/YYYY)
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI/CD Pages Workflow (Node 22)
├── server.ts               # Local Bun.serve API Proxy Server & Scraper (Port 1385)
├── vercel.json             # Vercel Deployment & Serverless Rewrite Config
└── package.json
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.
