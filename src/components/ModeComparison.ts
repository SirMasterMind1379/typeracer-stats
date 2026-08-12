import type { Race } from "../types";

export interface ModeMetrics {
  name: string;
  key: string;
  racesCount: number;
  sharePercent: string;
  avgWpm: string;
  bestWpm: string;
  avgAcc: string;
  winRate?: string;
  trend: string;
  icon: string;
}

export function categorizeRaceMode(r: Race): "multiplayer" | "practice_qotd" | "room" {
  const modeLower = (r.mode || "").toLowerCase();
  if (modeLower.includes("room")) {
    return "room";
  }
  if (
    modeLower.includes("qotd") ||
    modeLower.includes("quote of the day") ||
    modeLower.includes("practice") ||
    (r.totalRacers <= 1 && !r.mode)
  ) {
    return "practice_qotd";
  }
  return "multiplayer";
}

export function getModeStats(races: Race[]): ModeMetrics[] {
  const total = races.length;
  if (total === 0) return [];

  const groups: Record<"multiplayer" | "practice_qotd" | "room", Race[]> = {
    multiplayer: [],
    practice_qotd: [],
    room: [],
  };

  for (const r of races) {
    const cat = categorizeRaceMode(r);
    groups[cat].push(r);
  }

  const result: ModeMetrics[] = [
    {
      name: "Multiplayer / Main Track",
      key: "multiplayer",
      icon: "🏁",
      ...calculateGroupMetrics(groups.multiplayer, total, true),
    },
    {
      name: "Practice & QOTD",
      key: "practice_qotd",
      icon: "🎯",
      ...calculateGroupMetrics(groups.practice_qotd, total, false),
    },
    {
      name: "Custom Rooms",
      key: "room",
      icon: "👥",
      ...calculateGroupMetrics(groups.room, total, true),
    },
  ];

  return result.filter((m) => m.racesCount > 0);
}

function calculateGroupMetrics(group: Race[], totalAll: number, includeWinRate: boolean) {
  const racesCount = group.length;
  if (racesCount === 0) {
    return {
      racesCount: 0,
      sharePercent: "0.0",
      avgWpm: "0.00",
      bestWpm: "0.00",
      avgAcc: "0.00%",
      winRate: includeWinRate ? "0.00%" : undefined,
      trend: "0.0000 WPM/race",
    };
  }

  const sharePercent = ((racesCount / totalAll) * 100).toFixed(1); // 1 decimal as requested
  const speeds = group.map((r) => r.speed);
  const accs = group.map((r) => r.accuracy);
  const avgWpm = (speeds.reduce((a, b) => a + b, 0) / racesCount).toFixed(2); // 2 decimals
  const bestWpm = Math.max(...speeds, 0).toFixed(2); // 2 decimals
  const meanAcc = accs.reduce((a, b) => a + b, 0) / racesCount;
  const avgAccVal = meanAcc <= 1 ? meanAcc * 100 : meanAcc;
  const avgAcc = `${avgAccVal.toFixed(2)}%`;

  // Calculate 4-decimal trend slope over race indices
  let trendSlope = 0;
  if (speeds.length >= 2) {
    const n = speeds.length;
    const indices = speeds.map((_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = speeds.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((s, i) => s + i * speeds[i], 0);
    const sumX2 = indices.reduce((s, i) => s + i * i, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      trendSlope = (n * sumXY - sumX * sumY) / denom;
    }
  }
  const trend = `${trendSlope >= 0 ? "+" : ""}${trendSlope.toFixed(4)} WPM/race`; // 4 decimals as requested

  let winRate: string | undefined = undefined;
  if (includeWinRate) {
    const wins = group.filter((r) => r.won).length;
    winRate = `${((wins / racesCount) * 100).toFixed(2)}%`; // 2 decimals as requested
  }

  return { racesCount, sharePercent, avgWpm, bestWpm, avgAcc, winRate, trend };
}

export function renderModeComparison(races: Race[], onSelectMode?: (modeKey: string) => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 flex flex-col gap-3";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between";

  const title = document.createElement("h3");
  title.className = "text-sm font-semibold text-beige-700 dark:text-beige-300 uppercase tracking-wide flex items-center gap-2";
  title.innerHTML = `<span>📊</span> PER-MODE PERFORMANCE BREAKDOWN`;
  header.appendChild(title);

  const sub = document.createElement("span");
  sub.className = "text-xs text-beige-600 dark:text-beige-400 font-mono";
  sub.textContent = `${races.length} Total Races Analyzed`;
  header.appendChild(sub);

  container.appendChild(header);

  const stats = getModeStats(races);
  if (stats.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "text-xs text-beige-600 dark:text-beige-400 italic py-2";
    emptyMsg.textContent = "No race mode data available.";
    container.appendChild(emptyMsg);
    return container;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 sm:grid-cols-3 gap-3";

  stats.forEach((mode) => {
    const card = document.createElement("div");
    card.className =
      "bg-beige-200/50 dark:bg-beige-800/50 border border-beige-300 dark:border-beige-700 p-3 flex flex-col justify-between hover:border-red-900/50 dark:hover:border-red-500/50 transition-colors cursor-pointer";

    if (onSelectMode) {
      card.addEventListener("click", () => onSelectMode(mode.key));
    }

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-beige-900 dark:text-beige-100 flex items-center gap-1.5">
          <span>${mode.icon}</span> ${mode.name}
        </span>
        <span class="px-1.5 py-0.5 text-[10px] font-mono bg-beige-300/60 dark:bg-beige-700/60 text-beige-900 dark:text-beige-100 border border-beige-300 dark:border-beige-600">
          ${mode.sharePercent}% share
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Races</span>
          <span class="text-sm font-bold text-beige-900 dark:text-beige-100">${mode.racesCount}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Avg Speed</span>
          <span class="text-sm font-bold text-red-900 dark:text-red-400">${mode.avgWpm} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Best Speed</span>
          <span class="text-sm font-bold text-beige-800 dark:text-beige-200">${mode.bestWpm} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Avg Accuracy</span>
          <span class="text-sm font-bold text-beige-800 dark:text-beige-200">${mode.avgAcc}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">${mode.winRate ? "Win Rate" : "Mode"}</span>
          <span class="text-sm font-bold text-beige-800 dark:text-beige-200">${mode.winRate || "Practice"}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Speed Trend</span>
          <span class="text-xs font-bold ${mode.trend.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}">${mode.trend}</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  container.appendChild(grid);

  return container;
}
