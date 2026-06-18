# TypeRacer Stats

View your TypeRacer historical stats — speed, accuracy, points, and daily activity over time.

## Features

- **Historical race data** — speed (WPM), accuracy, points per race with rolling 10-race average
- **Interactive chart** — mouse-drag to select a timeframe; averages and stats update automatically
- **Multiple metrics** — toggle between speed, accuracy, and cumulative points
- **Regression trend line** — see your learning rate (WPM change per race) with a dashed trendline
- **Race limit filters** — filter to last 1000, 500, 200, 100, 50, or 20 races
- **Daily activity heatmap** — GitHub-style grid showing points earned per day with race checkmarks
- **QOTD status** — shows whether you've completed the Quote of the Day competition
- **Dark/light mode** — persists preference in localStorage, respects system preference
- **API key optional** — enter your key for full race history, or leave blank for basic profile stats

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Live Demo

[https://typeracer-stats.vercel.app](https://typeracer-stats.vercel.app)

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

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)

## License

MIT
