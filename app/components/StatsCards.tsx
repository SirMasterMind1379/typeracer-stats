import type { Stats, UserData } from "./types";

/**
 * StatsCards — aggregate stats.
 *
 * Without API races (scraped), shows typistLevel in place of totalWins.
 * With API races, shows totalWins alongside totalRaces.
 *
 * @param data - Full user payload (used to check race availability).
 */
export default function StatsCards({ data }: { data: UserData }) {
  const s = data.stats;
  if (!s) return null;

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
    { label: "Best WPM", value: s.bestWpm?.toFixed(1) ?? "—" },
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="p-3 bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700"
        >
          <p className="text-xs text-beige-700 dark:text-zinc-400">{item.label}</p>
          <p className="text-lg font-bold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
