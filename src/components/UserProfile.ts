import type { UserData } from "../types";
import { formatDisplayDate, computeStreak, escapeHtml } from "../types";

export function renderUserProfile(data: UserData, dataSource: "api" | "import" | "cache" | null): HTMLElement {
  const container = document.createElement("div");
  container.className = "flex flex-wrap items-center justify-between gap-4 p-4 bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100";

  const profileUrl = `https://data.typeracer.com/pit/profile?user=${data.username}`;

  const streak = computeStreak(data.races);
  const streakYesterday = computeStreak(data.races, { offsetDays: 1 });

  // 10+ streak counts only multiplayer races (QOTD excluded)
  const mpRaces = data.races.filter((r) => !r.mode?.toLowerCase().includes("qotd"));
  const streak10 = computeStreak(mpRaces, { minRaces: 10 });
  const streak10Yesterday = computeStreak(mpRaces, { minRaces: 10, offsetDays: 1 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = mpRaces.filter((r) => r.date.slice(0, 10) === todayStr).length;

  const activeStreak = streak > 0;
  const activeStreak10 = streak10 > 0;
  const staleStreak = streak === 0 && streakYesterday > 0;
  const staleStreak10 = streak10 === 0 && streak10Yesterday > 0;

  function flameConfig(s: number, blue = false) {
    const off = "text-beige-300 dark:text-beige-700";
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
  const greyCls = "text-beige-300 dark:text-beige-700";
  const showStreaks = activeStreak || activeStreak10 || staleStreak || staleStreak10;

  function renderFlames(config: { count: number; size: number; cls: string }) {
    return Array.from({ length: config.count })
      .map(
        () =>
          `<svg class="inline-block" width="${config.size}" height="${config.size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
      )
      .join("");
  }

  function getCountdownText() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = next.getTime() - now.getTime();
    if (diff <= 0) return "";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Next QOTD in ${h}h ${m}m`;
  }

  container.innerHTML = `
    <div>
      <h2 class="text-xl font-bold">
        <a
          href="${profileUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline underline-offset-2"
        >
          ${escapeHtml(data.name)}
        </a>
      </h2>
      <p class="text-sm text-beige-700 dark:text-beige-300">
        <a
          href="${profileUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline underline-offset-2"
        >
          @${escapeHtml(data.username)}
        </a>
        ${data.premium ? `<span class="ml-2 text-red-900 dark:text-red-400 font-semibold">Premium</span>` : ""}
      </p>
      ${
        data.joinedAt
          ? `<p class="text-xs text-beige-600 dark:text-beige-400 mt-1">Joined ${formatDisplayDate(data.joinedAt)}</p>`
          : ""
      }
      ${
        data.note
          ? `<p class="text-xs text-red-900 dark:text-red-400 mt-2 max-w-md">${escapeHtml(data.note)}</p>`
          : ""
      }

      ${
        showStreaks
          ? `
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <!-- Streak (any races) -->
          <span class="inline-flex items-center gap-0.5">
            <span class="text-[10px] font-semibold mr-0.5 text-beige-600 dark:text-beige-400">S</span>
            <span class="inline-flex items-center gap-0.5 ${activeStreak ? flame.cls : greyCls}">
              ${renderFlames(flame)}
              <span class="text-sm font-bold ml-0.5">${activeStreak ? streak : streakYesterday}</span>
            </span>
            ${
              staleStreak
                ? `<span class="text-[11px] text-beige-600 dark:text-beige-400 ml-1">Not yet raced today</span>`
                : ""
            }
          </span>

          <!-- Streak (10+ races/day) -->
          <span class="inline-flex items-center gap-0.5">
            <span class="text-[10px] font-semibold mr-0.5 text-beige-600 dark:text-beige-400">10+</span>
            <span class="inline-flex items-center gap-0.5 ${activeStreak10 ? flame10.cls : greyCls}">
              ${renderFlames(flame10)}
              <span class="text-sm font-bold ml-0.5">${activeStreak10 ? streak10 : streak10Yesterday}</span>
            </span>
            ${
              staleStreak10
                ? `<span class="text-[11px] text-beige-600 dark:text-beige-400 ml-1">${
                    todayCount >= 10 ? "Done today" : `${10 - todayCount} more needed`
                  }</span>`
                : ""
            }
          </span>
        </div>
      `
          : ""
      }
    </div>

    ${
      dataSource === "api"
        ? `
      <div class="flex flex-col items-end gap-1">
        <a
          href="https://play.typeracer.com"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-1.5 text-sm font-medium border inline-block ${
            data.qotdDone
              ? "bg-emerald-700 text-white border-emerald-800 dark:bg-emerald-800 dark:text-emerald-100 dark:border-emerald-600"
              : "bg-beige-50 dark:bg-beige-800 border-beige-300 dark:border-beige-700 text-beige-700 dark:text-beige-300"
          }"
        >
          QOTD: ${data.qotdDone ? "Done ✓" : "Not Done"}
        </a>
        <span id="qotd-countdown" class="text-[10px] text-beige-600 dark:text-beige-400">${getCountdownText()}</span>
      </div>
    `
        : ""
    }
  `;

  return container;
}
