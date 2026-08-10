import type { TimeframeStats as TStats } from "../types";

export function renderTimeframeStats(stats: TStats | null): HTMLElement {
  const container = document.createElement("div");
  container.className = "grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 text-xs";

  if (!stats) return container;

  const items = [
    { label: "Races", value: stats.races.toLocaleString() },
    { label: "Avg Speed", value: `${stats.avgSpeed} WPM` },
    { label: "Avg Accuracy", value: `${stats.avgAcc}%` },
    { label: "Wins", value: `${stats.wins} (${stats.winRate}%)` },
    { label: "Total Points", value: Number(stats.totalPoints).toLocaleString() },
  ];

  container.innerHTML = items
    .map(
      (item) => `
    <div class="flex flex-col">
      <span class="text-beige-700 dark:text-beige-400 uppercase tracking-wider text-[10px]">${item.label}</span>
      <span class="font-semibold text-sm text-beige-900 dark:text-beige-100">${item.value}</span>
    </div>
  `
    )
    .join("");

  return container;
}
