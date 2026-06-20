import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Race } from "./types";
import { formatDisplayDate } from "./types";

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

  /** Build exactly 52 weeks of cells, each column Sun–Sat, ending on the upcoming Saturday. */
  const cells = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    // Closest upcoming Saturday (or today if Saturday)
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    // Sunday 363 days before end = first day of 52-week grid
    const start = new Date(end);
    start.setDate(start.getDate() - 363);
    const out: { date: string; points: number; count: number; day: number; week: number; future: boolean }[] = [];
    for (let i = 0; i < 364; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const info = byDate.get(key) || { points: 0, count: 0 };
      out.push({ date: key, points: info.points, count: info.count, day: d.getDay(), week: Math.floor(i / 7), future: key > todayStr });
    }
    return out;
  }, [byDate]);

  const maxPoints = Math.max(1, ...cells.map((c) => c.points));
  const weekCount = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

  const weekDates = useMemo(() => {
    const dates: string[] = [];
    for (let w = 0; w < weekCount; w++) {
      const sunCell = cells.find((c) => c.week === w && c.day === 0);
      dates.push(sunCell ? formatDisplayDate(sunCell.date) : "");
    }
    return dates;
  }, [cells, weekCount]);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    <div className="overflow-x-auto w-full flex justify-center">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `auto repeat(${weekCount}, 14px)`,
          gridTemplateRows: `35px repeat(7, 14px)`,
          gap: "3px",
        }}
      >
        {/* Day-of-week labels — column 1, rows 2–8 */}
        {dayLabels.map((l, i) => (
          <div
            key={`label-${i}`}
            className="text-[10px] leading-[14px] text-beige-600 dark:text-zinc-500 text-right pr-1 flex items-center justify-end"
            style={{ gridColumn: 1, gridRow: i + 2 }}
          >
            {l}
          </div>
        ))}
        {/* Week-start date labels (angled) — row 1, columns 2–53 */}
        {weekDates.map((d, w) => (
          <div
            key={`date-${w}`}
            className="text-[9px] leading-[10px] text-beige-600 dark:text-zinc-500 flex items-end"
            style={{
              gridColumn: w + 2,
              gridRow: 1,
              transform: "rotate(-30deg)",
              transformOrigin: "bottom left",
              whiteSpace: "nowrap",
            }}
          >
            {d}
          </div>
        ))}
        {/* Cells — columns 2–53, rows 2–8 */}
        {cells.map((c) => {
          const key = `${c.week}-${c.day}`;
          if (c.future) {
            return (
              <div
                key={key}
                className="bg-transparent"
                style={{ gridColumn: c.week + 2, gridRow: c.day + 2 }}
              />
            );
          }
          return (
            <div
              key={key}
              title={`${c.date} — ${c.count} race${c.count !== 1 ? "s" : ""}, ${c.points} pts`}
              className={`flex items-center justify-center w-[14px] h-[14px] ${cellColor(c.points, c.count)}`}
              style={{ gridColumn: c.week + 2, gridRow: c.day + 2 }}
            >
              {c.count > 0 && (
                <Check size={10} className={checkMarkColor(c.points, c.count)} strokeWidth={3} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
