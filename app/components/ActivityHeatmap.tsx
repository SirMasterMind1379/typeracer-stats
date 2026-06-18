import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Race } from "./types";

/**
 * ActivityHeatmapProps
 *
 * @param races - All race data (used to compute per-day points and counts).
 * @param dark  - Whether dark mode is active (affects colour selection).
 */
export interface ActivityHeatmapProps {
  races: Race[];
  dark: boolean;
}

/**
 * ActivityHeatmap — a GitHub-style grid showing daily activity.
 *
 * Each column is a week, each row a day of the week. Cell colour
 * intensity reflects total points earned that day. A check mark
 * indicates at least one race was completed.
 */
export default function ActivityHeatmap({ races, dark }: ActivityHeatmapProps) {
  /** Map of "YYYY-MM-DD" → { points, count }. */
  const byDate = useMemo(() => {
    const map = new Map<string, { points: number; count: number }>();
    for (const r of races) {
      const key = r.date.slice(0, 10);
      const cur = map.get(key) || { points: 0, count: 0 };
      cur.points += r.points || 0;
      cur.count++;
      map.set(key, cur);
    }
    return map;
  }, [races]);

  /** Build a 52-week grid of cells. */
  const cells = useMemo(() => {
    const today = new Date();
    const out: { date: string; points: number; count: number; day: number; week: number }[] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const info = byDate.get(key) || { points: 0, count: 0 };
      const dayOfWeek = d.getDay();
      const msDiff = d.getTime() - start.getTime();
      const week = Math.floor(msDiff / (7 * 86400000));
      out.push({ date: key, points: info.points, count: info.count, day: dayOfWeek, week });
    }
    return out;
  }, [byDate]);

  const maxPoints = Math.max(1, ...cells.map((c) => c.points));
  const weekCount = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  function cellColor(points: number, count: number): string {
    if (count === 0) return dark ? "bg-zinc-800" : "bg-beige-100";
    const intensity = Math.min(1, points / maxPoints);
    if (dark) {
      const levels = ["bg-red-950", "bg-red-900", "bg-red-800", "bg-red-700", "bg-red-600", "bg-red-500"];
      const idx = Math.min(levels.length - 1, Math.floor(intensity * levels.length));
      return levels[idx];
    }
    const levels = ["bg-red-100", "bg-red-200", "bg-red-400", "bg-red-600", "bg-red-800", "bg-red-900"];
    const idx = Math.min(levels.length - 1, Math.floor(intensity * levels.length));
    return levels[idx];
  }

  function checkMarkColor(points: number, count: number): string {
    if (count === 0) return "text-transparent";
    if (dark) {
      return points > maxPoints * 0.25 ? "text-beige-100" : "text-red-300";
    }
    return points > maxPoints * 0.35 ? "text-beige-50" : "text-red-900";
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((l, i) => (
            <div
              key={i}
              className="h-[14px] text-[10px] leading-[14px] text-beige-600 dark:text-zinc-500 w-8 text-right pr-1"
            >
              {l}
            </div>
          ))}
        </div>

        {/* Grid of weeks */}
        <div className="flex gap-[3px]">
          {Array.from({ length: weekCount }, (_, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const c = cells.find((c) => c.week === w && c.day === day);
                if (!c) return <div key={day} className="w-[14px] h-[14px] bg-transparent" />;
                return (
                  <div
                    key={day}
                    title={`${c.date} — ${c.count} race${c.count !== 1 ? "s" : ""}, ${c.points} pts`}
                    className={`w-[14px] h-[14px] flex items-center justify-center ${cellColor(c.points, c.count)}`}
                  >
                    {c.count > 0 && (
                      <Check size={10} className={checkMarkColor(c.points, c.count)} strokeWidth={3} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
