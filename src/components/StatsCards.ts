import type { UserData } from "../types";

export function renderStatsCards(data: UserData): HTMLElement {
  const container = document.createElement("div");
  container.className = "grid grid-cols-2 sm:grid-cols-4 gap-3";

  const s = data.stats;
  if (!s) return container;

  const hasApi = data.races.length > 0;

  const items: { label: string; value: string }[] = [
    {
      label: hasApi ? "Races" : "Total Races",
      value: s.totalRaces.toLocaleString(),
    },
  ];

  if (hasApi) {
    items.push({
      label: "Wins",
      value: (s.totalWins ?? 0).toLocaleString(),
    });
  } else if (s.typistLevel) {
    items.push({
      label: "Typist",
      value: s.typistLevel,
    });
  }

  items.push(
    { label: "Avg WPM", value: s.avgWpm?.toFixed(1) ?? "—" },
    { label: "Best WPM", value: s.bestWpm?.toFixed(1) ?? "—" }
  );

  container.innerHTML = items
    .map(
      (item) => `
    <div class="p-3 bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700">
      <p class="text-xs text-beige-700 dark:text-beige-400">${item.label}</p>
      <p class="text-lg font-bold text-beige-900 dark:text-beige-100">${item.value}</p>
    </div>
  `
    )
    .join("");

  return container;
}
