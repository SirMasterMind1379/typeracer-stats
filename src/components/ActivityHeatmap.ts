import type { Race } from "../types";
import { formatDisplayDate } from "../types";

export interface ActivityHeatmapProps {
  races: Race[];
  dark: boolean;
}

// 52-Week GitHub-style Activity Heatmap (CSS Grid layout, -30deg week header date labels, daily checkmarks)
export function renderActivityHeatmap(props: ActivityHeatmapProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "overflow-x-auto w-full flex justify-center";

  const { races, dark } = props;

  // Aggregate daily race statistics by "YYYY-MM-DD"
  const byDate = new Map<string, { points: number; count: number }>();
  for (const r of races) {
    const key = r.date.slice(0, 10);
    const cur = byDate.get(key) || { points: 0, count: 0 };
    cur.points += r.points || 0;
    cur.count++;
    byDate.set(key, cur);
  }

  // Calculate 52-week grid bounds (364 days ending on upcoming Saturday)
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - 363);

  const cells: { date: string; points: number; count: number; day: number; week: number; future: boolean }[] = [];
  for (let i = 0; i < 364; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const info = byDate.get(key) || { points: 0, count: 0 };
    cells.push({ date: key, points: info.points, count: info.count, day: d.getDay(), week: Math.floor(i / 7), future: key > todayStr });
  }

  const maxPoints = Math.max(1, ...cells.map((c) => c.points));
  const weekCount = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

  // Sunday week-start date label formatting (MMM/DD/YYYY)
  const weekDates: string[] = [];
  for (let w = 0; w < weekCount; w++) {
    const sunCell = cells.find((c) => c.week === w && c.day === 0);
    weekDates.push(sunCell ? formatDisplayDate(sunCell.date) : "");
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Heatmap intensity color calculation based on daily points earned
  function cellColor(points: number, count: number): string {
    if (count === 0) return dark ? "bg-beige-900/60" : "bg-beige-200/60";
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

  // Checkmark icon contrast color calculation
  function checkMarkColor(points: number, count: number): string {
    if (count === 0) return "text-transparent";
    if (dark) {
      return points > maxPoints * 0.25 ? "text-beige-100" : "text-red-300";
    }
    return points > maxPoints * 0.35 ? "text-beige-50" : "text-red-900";
  }

  container.innerHTML = `
    <div
      class="grid"
      style="grid-template-columns: auto repeat(${weekCount}, 14px); grid-template-rows: 35px repeat(7, 14px); gap: 3px;"
    >
      <!-- 7 Weekday Labels (Sun-Sat) on left -->
      ${dayLabels
        .map(
          (l, i) => `
        <div
          class="text-[10px] leading-[14px] text-beige-600 dark:text-beige-400 text-right pr-1 flex items-center justify-end"
          style="grid-column: 1; grid-row: ${i + 2}"
        >
          ${l}
        </div>
      `
        )
        .join("")}
      <!-- Week-start Date Headers angled at -30deg -->
      ${weekDates
        .map(
          (d, w) => `
        <div
          class="text-[9px] leading-[10px] text-beige-600 dark:text-beige-400 flex items-end"
          style="grid-column: ${w + 2}; grid-row: 1; transform: rotate(-30deg); transform-origin: bottom left; white-space: nowrap;"
        >
          ${d}
        </div>
      `
        )
        .join("")}
      <!-- 52-Week Grid Cells -->
      ${cells
        .map((c) => {
          if (c.future) {
            return `<div class="bg-transparent" style="grid-column: ${c.week + 2}; grid-row: ${c.day + 2}"></div>`;
          }
          return `
            <div
              title="${c.date} — ${c.count} race${c.count !== 1 ? "s" : ""}, ${c.points} pts"
              class="flex items-center justify-center w-[14px] h-[14px] ${cellColor(c.points, c.count)}"
              style="grid-column: ${c.week + 2}; grid-row: ${c.day + 2}"
            >
              ${
                c.count > 0
                  ? `<svg class="${checkMarkColor(
                      c.points,
                      c.count
                    )}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  return container;
}
