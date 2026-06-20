import { useCallback } from "react";
import { Download } from "lucide-react";
import Papa from "papaparse";
import type { UserData, Race } from "./types";

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

export default function CsvExportButton({ data, allRaces }: { data: UserData; allRaces: Race[] }) {
  const handleExport = useCallback(() => {
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
  }, [allRaces, data]);

  return (
    <button
      onClick={handleExport}
      className="w-full py-3 text-sm font-medium border bg-beige-50 dark:bg-zinc-900 border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-2"
      aria-label="Export as CSV"
    >
      <Download size={14} />
      Export CSV
    </button>
  );
}
