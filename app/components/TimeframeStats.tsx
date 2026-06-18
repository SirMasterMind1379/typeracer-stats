import type { TimeframeStats as TStats } from "./types";

/**
 * TimeframeStats — summary cards for the currently visible time range.
 *
 * @param stats - Computed stats for the selected timeframe (may be null).
 */
export default function TimeframeStats({ stats }: { stats: TStats | null }) {
  if (!stats) return null;

  const items = [
    { label: "Races", value: stats.races },
    { label: "Avg Speed", value: `${stats.avgSpeed} wpm` },
    { label: "Avg Accuracy", value: `${stats.avgAcc}%` },
    { label: "Wins", value: `${stats.wins} (${stats.winRate}%)` },
    { label: "Points Gained", value: stats.totalPoints },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="p-2 bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 text-center"
        >
          <p className="text-xs text-beige-700 dark:text-zinc-400">{s.label}</p>
          <p className="text-sm font-bold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
