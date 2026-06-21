import { useMemo, useState, useEffect } from "react";
import { Flame } from "lucide-react";
import type { UserData } from "./types";
import { formatDisplayDate, computeStreak } from "./types";

/**
 * UserProfile — displays racer info, streaks, and QOTD.
 *
 * @param data - Full user payload from the API.
 */
export default function UserProfile({ data, dataSource }: { data: UserData; dataSource: "api" | "import" | null }) {
  const profileUrl = `https://data.typeracer.com/pit/profile?user=${data.username}`;

  const streak = useMemo(() => computeStreak(data.races), [data]);
  const streakYesterday = useMemo(() => computeStreak(data.races, { offsetDays: 1 }), [data]);
  const streak10 = useMemo(() => computeStreak(data.races, { minRaces: 10 }), [data]);
  const streak10Yesterday = useMemo(() => computeStreak(data.races, { minRaces: 10, offsetDays: 1 }), [data]);

  const todayCount = useMemo(() => {
    if (!data.races.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return data.races.filter((r) => r.date.slice(0, 10) === today).length;
  }, [data]);

  const activeStreak = streak > 0;
  const activeStreak10 = streak10 > 0;
  const staleStreak = streak === 0 && streakYesterday > 0;
  const staleStreak10 = streak10 === 0 && streak10Yesterday > 0;

  function flameConfig(s: number, blue = false) {
    const off = "text-zinc-300 dark:text-zinc-600";
    if (s === 0) return { count: 0, size: 16, cls: off };
    if (blue) {
      if (s < 5) return { count: 1, size: 16, cls: "text-blue-400" };
      if (s < 10) return { count: 1, size: 18, cls: "text-blue-500" };
      if (s < 20) return { count: 1, size: 20, cls: "text-blue-600" };
      if (s < 50) return { count: 1, size: 24, cls: "text-blue-700" };
      if (s < 100) return { count: 2, size: 20, cls: "text-blue-800" };
      if (s < 365) return { count: 3, size: 18, cls: "text-blue-900" };
      return { count: 4, size: 18, cls: "text-blue-950 dark:text-blue-400" };
    }
    if (s < 5) return { count: 1, size: 16, cls: "text-orange-400" };
    if (s < 10) return { count: 1, size: 18, cls: "text-orange-500" };
    if (s < 20) return { count: 1, size: 20, cls: "text-red-500" };
    if (s < 50) return { count: 1, size: 24, cls: "text-red-600" };
    if (s < 100) return { count: 2, size: 20, cls: "text-red-700" };
    if (s < 365) return { count: 3, size: 18, cls: "text-red-800" };
    return { count: 4, size: 18, cls: "text-red-900 dark:text-red-400" };
  }

  const flame = flameConfig(activeStreak ? streak : streakYesterday);
  const flame10 = flameConfig(activeStreak10 ? streak10 : streak10Yesterday, true);
  const greyCls = "text-zinc-300 dark:text-zinc-600";

  const showStreaks = activeStreak || activeStreak10 || staleStreak || staleStreak10;

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    function update() {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = next.getTime() - now.getTime();
      if (diff <= 0) { setCountdown(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`Next QOTD in ${h}h ${m}m`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700">
      <div>
        <h2 className="text-xl font-bold">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-2"
          >
            {data.name}
          </a>
        </h2>
        <p className="text-sm text-beige-700 dark:text-zinc-400">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-2"
          >
            @{data.username}
          </a>
          {data.premium && (
            <span className="ml-2 text-red-900 dark:text-red-400 font-semibold">Premium</span>
          )}
        </p>
        {data.joinedAt && (
          <p className="text-xs text-beige-600 dark:text-zinc-500 mt-1">
            Joined {formatDisplayDate(data.joinedAt)}
          </p>
        )}
        {data.note && (
          <p className="text-xs text-red-900 dark:text-red-400 mt-2 max-w-md">{data.note}</p>
        )}

        {showStreaks && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {/* Streak (any races) */}
            <span className="inline-flex items-center gap-0.5">
              <span className="text-[10px] font-semibold mr-0.5 text-beige-600 dark:text-zinc-500">S</span>
              <span className={`inline-flex items-center gap-0.5 ${activeStreak ? flame.cls : greyCls}`}>
                {Array.from({ length: flame.count }, (_, i) => (
                  <Flame key={i} size={flame.size} fill="currentColor" />
                ))}
                <span className="text-sm font-bold ml-0.5">
                  {activeStreak ? streak : streakYesterday}
                </span>
              </span>
              {staleStreak && (
                <span className="text-[11px] text-beige-500 dark:text-zinc-500 ml-1">
                  Not yet raced today
                </span>
              )}
            </span>

            {/* Streak (10+ races/day) */}
            <span className="inline-flex items-center gap-0.5">
              <span className="text-[10px] font-semibold mr-0.5 text-beige-600 dark:text-zinc-500">10+</span>
              <span className={`inline-flex items-center gap-0.5 ${activeStreak10 ? flame10.cls : greyCls}`}>
                {Array.from({ length: flame10.count }, (_, i) => (
                  <Flame key={i} size={flame10.size} fill="currentColor" />
                ))}
                <span className="text-sm font-bold ml-0.5">
                  {activeStreak10 ? streak10 : streak10Yesterday}
                </span>
              </span>
              {staleStreak10 && (
                <span className="text-[11px] text-beige-500 dark:text-zinc-500 ml-1">
                  {todayCount >= 10 ? "Done today" : `${10 - todayCount} more needed`}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {dataSource === "api" && (
        <div className="flex flex-col items-end gap-1">
          <a
            href="https://play.typeracer.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-1.5 text-sm font-medium border inline-block ${
              data.qotdDone
                ? "bg-red-50 dark:bg-red-950 border-red-700 text-red-800 dark:text-red-200"
                : "bg-beige-50 dark:bg-zinc-800 border-beige-300 dark:border-zinc-600 text-beige-700 dark:text-zinc-400"
            }`}
          >
            QOTD: {data.qotdDone ? "Done" : "Not Done"}
          </a>
          {countdown && (
            <span className="text-[10px] text-beige-500 dark:text-zinc-500">{countdown}</span>
          )}
        </div>
      )}
    </div>
  );
}
