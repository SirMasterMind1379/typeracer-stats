import Papa from "papaparse";
import type { UserData, Race } from "../types";

function formatDateUtc(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${dd} ${h}:${mi}:${s}.${ms}000`;
}

export function renderCsvExportButton(data: UserData, allRaces: Race[]): HTMLElement {
  const button = document.createElement("button");
  button.className = "w-full py-3 text-sm font-medium border bg-beige-100 dark:bg-beige-900 border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 inline-flex items-center justify-center gap-2 cursor-pointer";
  button.setAttribute("aria-label", "Export as CSV");

  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
    Export CSV
  `;

  button.addEventListener("click", () => {
    const sorted = [...allRaces].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const rows = sorted.map((race, i) => ({
      Universe: "play",
      "Race #": i + 1,
      Mode: race.mode || "",
      "Race ID": race.id,
      "Text ID": race.textId,
      "Skill Level": "",
      WPM: race.speed,
      Accuracy: race.accuracy / 100,
      Points: race.points ?? "",
      Rank: race.rank,
      "# Racers": race.totalRacers,
      Won: race.rank === 1,
      Keylog: "",
      "Date/Time (UTC)": formatDateUtc(race.date),
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `typeracer-stats-${data.username}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  return button;
}
