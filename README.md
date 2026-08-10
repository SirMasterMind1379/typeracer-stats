# ⌨️ TypeRacer Stats V2

> **Production-Grade TypeRacer Analytics & Race History Visualizer**  
> Built with Pure Vanilla TypeScript, Vite 6, Tailwind CSS v4, and Native API Proxying. Zero heavy UI frameworks.

[![Live Demo on Vercel](https://img.shields.io/badge/Vercel_Deployment-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://typeracer-stats.vercel.app)
[![Live Demo on GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live_Demo-222222?style=for-the-badge&logo=github&logoColor=white)](https://sirmastermind1379.github.io/typeracer-stats/)

---

### 🌐 Try the Live Deployments

- 🚀 **Vercel Deployment (Full Serverless Proxy)**: [https://typeracer-stats.vercel.app](https://typeracer-stats.vercel.app)
- ⚡ **GitHub Pages Deployment**: [https://sirmastermind1379.github.io/typeracer-stats/](https://sirmastermind1379.github.io/typeracer-stats/)


## ✨ Features & Highlights

- **⚡ Zero-Framework Architecture**: High-performance pure DOM TypeScript rendering under 65KB gzipped.
- **📊 Interactive SVG Charts**: Progressive left-to-right polyline draw (`pathLength="1"`), rotated date ticks (-15°), and linear trend regression math.
- **🎯 Snapped Crosshair & Hover Tooltip**: Vertical crosshair line snaps to data points with floating detail cards (WPM, Date `MMM/DD/YYYY`, Accuracy, Rank, Mode).
- **🔎 Drag-to-Zoom & Touch Gestures**: In-place SVG overlay highlighting timeframe slices with auto-recalculated summary statistics. Pinch-to-zoom and tap-to-reset on mobile.
- **📅 52-Week Activity Heatmap**: GitHub-style calendar grid ending on the current week's Saturday with angled Sunday headers (-30°) and daily race intensity tooltips.
- **⚡ IndexedDB Fast Cache**: Privacy-gated local storage (`typeracer_db`) for zero-latency instant reloads.
- **🎨 Red Velvet & Sunny Cream Aesthetic**: Dual-theme support with sunny cream (`#fdf8ea`) light mode, grey velvet (`#161214`) dark mode, and crimson red (`#800000`) accents.
- **🔒 API Key Privacy Guard**: Strict privacy gating — anonymous searches pull public profile statistics only. Historical race data is isolated behind user API keys.
- **📥 Data Export & CSV Parse**: Export charts as PNG images (`dom-to-image-more`) or download complete race logs as CSV files. CSV import support for offline data viewing.

---

## 🚀 Quickstart & Development Setup

### Prerequisites
- Node.js 18+ & npm
- [Bun](https://bun.sh) (optional, for native local API server)

### Installation
```bash
git clone https://github.com/SirMasterMind1379/typeracer-stats.git
cd typeracer-stats
npm install
```

### Running Locally
```bash
# Start Vite Frontend Dev Server (Port 1384)
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
3. Vercel automatically detects the Vite build (`npm run build`) and routes `/api/*` requests to the serverless function. Zero server configuration required!

### Option 2: GitHub Pages (Static Host)
The repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. Enable GitHub Pages in your repository settings: **Settings > Pages > Source: GitHub Actions**.
2. Whenever you push to `main` or publish a version tag (e.g. `v2.0.0`), GitHub Actions automatically builds and deploys the static application.

---

## 📐 Project Structure

```
├── api/
│   └── user-stats.ts       # Vercel Serverless Function proxy handler
├── src/
│   ├── components/         # Modular UI Components
│   │   ├── ActivityHeatmap.ts
│   │   ├── Chart.ts        # Interactive SVG Chart with Crosshairs & Touch Zoom
│   │   ├── CsvExportButton.ts
│   │   ├── DataImport.ts
│   │   ├── ErrorBanner.ts
│   │   ├── ExportButton.ts
│   │   ├── Header.ts
│   │   ├── RaceTable.ts    # Sortable & Filterable Race Log Table
│   │   ├── SearchForm.ts   # Credential Form & Cookie Memory
│   │   ├── StatsCards.ts
│   │   ├── TimeframeStats.ts
│   │   └── UserProfile.ts  # Profile Card & Streak Flame Counters
│   ├── db.ts               # IndexedDB Storage Engine (typeracer_db)
│   ├── index.css           # Tailwind v4 Configuration & Red Velvet Theme
│   ├── main.ts             # App State Machine & Render Loop
│   └── types.ts            # TypeScript Models & Date Helpers (MMM/DD/YYYY)
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI/CD Pages Workflow
├── server.ts               # Local Bun.serve API Proxy Server (Port 1385)
├── vercel.json             # Vercel Deployment & Rewrite Config
└── package.json
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.
