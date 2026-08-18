import type { ExtensionRace, StreakInfo } from "../types";
import { isCompetitiveRace, getToday00UTC, formatCountdown } from "../types";

export class StreakTracker {
  private targetRaces = 10;

  public getTodayUTCDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public getSecondsUntilReset(): number {
    const now = Date.now();
    const today00UTC = getToday00UTC();
    const nextResetUTC = today00UTC + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((nextResetUTC - now) / 1000));
  }

  public async checkQOTDFromAPI(username: string): Promise<boolean> {
    if (!username) return false;

    // 1. Extension messaging fallback (bypasses CORS via Service Worker)
    if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        const res: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CHECK_QOTD", username }, (response) => {
            if (typeof chrome !== "undefined" && chrome.runtime?.lastError) resolve(null);
            else resolve(response);
          });
        });
        if (res && res.success) {
          return !!res.qotdDone;
        }
      } catch {
        // ignore
      }
    }

    // 2. GM_xmlhttpRequest fallback for Userscript (bypasses CORS)
    if (typeof (window as any).GM_xmlhttpRequest === "function") {
      try {
        const todayStr = this.getTodayUTCDateString();
        for (const uni of ["play", "qotd"]) {
          const jsonText: string = await new Promise((resolve, reject) => {
            (window as any).GM_xmlhttpRequest({
              method: "GET",
              url: `https://data.typeracer.com/api/v2/competitions?universe=${uni}&date=${todayStr}`,
              onload: (res: any) => resolve(res.responseText),
              onerror: (err: any) => reject(err),
            });
          });
          const comps = JSON.parse(jsonText);
          const compList = Array.isArray(comps) ? comps : [];
          if (compList.length > 0 && compList[0].uid) {
            const resText: string = await new Promise((resolve, reject) => {
              (window as any).GM_xmlhttpRequest({
                method: "GET",
                url: `https://data.typeracer.com/api/v2/competitions/results?uid=${compList[0].uid}`,
                onload: (res: any) => resolve(res.responseText),
                onerror: (err: any) => reject(err),
              });
            });
            const results = JSON.parse(resText);
            const list = Array.isArray(results) ? results : [];
            if (list.some((r: any) => (r.username || r.u || "").toLowerCase() === username.toLowerCase())) {
              return true;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Direct fetch fallback (quietly catch page CORS blocks)
    try {
      const todayStr = this.getTodayUTCDateString();
      for (const uni of ["play", "qotd"]) {
        const compRes = await fetch(`https://data.typeracer.com/api/v2/competitions?universe=${uni}&date=${todayStr}`);
        if (compRes.ok) {
          const comps = await compRes.json();
          const compList = Array.isArray(comps) ? comps : [];
          if (compList.length > 0 && compList[0].uid) {
            const resRes = await fetch(`https://data.typeracer.com/api/v2/competitions/results?uid=${compList[0].uid}`);
            if (resRes.ok) {
              const results = await resRes.json();
              const list = Array.isArray(results) ? results : [];
              if (list.some((r: any) => (r.username || r.u || "").toLowerCase() === username.toLowerCase())) {
                return true;
              }
            }
          }
        }
      }
    } catch {
      // Quietly swallow CORS error in page context
    }
    return false;
  }

  public calculateDayStreak(allRaces: ExtensionRace[]): number {
    const dayCounts = new Map<string, number>();

    // Deduplicate races by id or (textId + wpm + timestamp)
    const deduped: ExtensionRace[] = [];
    for (const r of allRaces) {
      if (!deduped.some((existing) => isSameRace(existing, r))) {
        deduped.push(r);
      }
    }

    // 1. Group competitive multiplayer races by UTC date (YYYY-MM-DD)
    for (const r of deduped) {
      if (!isCompetitiveRace(r)) continue;
      const ts = typeof r.timestamp === "number" ? r.timestamp : 0;
      if (!ts) continue;
      const d = new Date(ts);
      const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
    }

    const now = new Date();
    const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    let currentStreak = 0;
    const todayCount = dayCounts.get(todayKey) || 0;

    // If today is completed (>= 10 races), start streak count from today
    let checkDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (todayCount >= this.targetRaces) {
      currentStreak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      // If today is in progress (< 10 races), start checking from yesterday so active streak is not lost
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    // Step backwards day by day to count consecutive days with >= 10 multiplayer races
    while (true) {
      const key = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDate.getUTCDate()).padStart(2, "0")}`;
      const count = dayCounts.get(key) || 0;
      if (count >= this.targetRaces) {
        currentStreak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }

    return currentStreak;
  }

  public calculateStreakInfo(races: ExtensionRace[], qotdDoneOverride = false): StreakInfo {
    const today00UTC = getToday00UTC();

    // Deduplicate races before calculation to prevent race doubling
    const deduped: ExtensionRace[] = [];
    for (const r of races) {
      if (!deduped.some((existing) => isSameRace(existing, r))) {
        deduped.push(r);
      }
    }

    // Filter races completed today in UTC (since 00:00 UTC / 8:00 PM EDT)
    const todayRaces = deduped.filter((r) => {
      const ts = typeof r.timestamp === "number" ? r.timestamp : 0;
      return ts >= today00UTC;
    });

    // Multiplayer races ONLY for 10-race streak calculation
    const todayMultiplayerRaces = todayRaces.filter(isCompetitiveRace);

    // QOTD races completed today
    const todayQotdRaces = todayRaces.filter((r) => {
      const m = (r.mode || "").toLowerCase();
      return m.includes("qotd") || m.includes("quote") || m === "competition" || m === "daily";
    });

    const racesDoneToday = todayMultiplayerRaces.length;
    const racesRemaining = Math.max(0, this.targetRaces - racesDoneToday);

    const qotdDone = qotdDoneOverride || todayQotdRaces.length > 0;

    // Calculate Best Multiplayer WPM Today
    const wpmsToday = todayMultiplayerRaces.map((r) => r.wpm).filter((w) => typeof w === "number" && !isNaN(w) && w > 0);
    const bestWpmToday = wpmsToday.length > 0 ? Math.max(...wpmsToday) : null;

    // Calculate Best QOTD WPM Today
    const qotdWpmsToday = todayQotdRaces.map((r) => r.wpm).filter((w) => typeof w === "number" && !isNaN(w) && w > 0);
    const bestQotdToday = qotdWpmsToday.length > 0 ? Math.max(...qotdWpmsToday) : null;

    const currentDayStreak = this.calculateDayStreak(races);

    const secondsUntilReset = this.getSecondsUntilReset();
    const formattedCountdown = formatCountdown(secondsUntilReset);

    return {
      racesDoneToday,
      racesRemaining,
      targetDaily: this.targetRaces,
      bestWpmToday,
      qotdDone,
      bestQotdToday,
      currentDayStreak,
      secondsUntilReset,
      formattedCountdown,
    };
  }

  public isNotificationNeeded(streakInfo: StreakInfo): boolean {
    const isWithinOneHour = streakInfo.secondsUntilReset <= 3600 && streakInfo.secondsUntilReset > 0;
    const streakIncomplete = streakInfo.racesRemaining > 0 || !streakInfo.qotdDone;
    return isWithinOneHour && streakIncomplete;
  }
}
