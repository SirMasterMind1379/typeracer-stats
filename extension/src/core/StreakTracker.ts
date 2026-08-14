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
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
      try {
        const res: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CHECK_QOTD", username }, (response) => {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) resolve(null);
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
        const jsonText: string = await new Promise((resolve, reject) => {
          (window as any).GM_xmlhttpRequest({
            method: "GET",
            url: `https://data.typeracer.com/api/v2/competitions?universe=play&date=${todayStr}`,
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
          return list.some((r: any) => (r.username || r.u || "").toLowerCase() === username.toLowerCase());
        }
      } catch {
        // ignore
      }
    }

    // 3. Direct fetch fallback (quietly catch page CORS blocks)
    try {
      const todayStr = this.getTodayUTCDateString();
      const compRes = await fetch(`https://data.typeracer.com/api/v2/competitions?universe=play&date=${todayStr}`);
      if (compRes.ok) {
        const comps = await compRes.json();
        const compList = Array.isArray(comps) ? comps : [];
        if (compList.length > 0 && compList[0].uid) {
          const resRes = await fetch(`https://data.typeracer.com/api/v2/competitions/results?uid=${compList[0].uid}`);
          if (resRes.ok) {
            const results = await resRes.json();
            const list = Array.isArray(results) ? results : [];
            return list.some((r: any) => (r.username || r.u || "").toLowerCase() === username.toLowerCase());
          }
        }
      }
    } catch {
      // Quietly swallow CORS error in page context
    }
    return false;
  }

  public calculateStreakInfo(races: ExtensionRace[], qotdDoneOverride = false): StreakInfo {
    const today00UTC = getToday00UTC();

    // Filter races completed today in UTC (since 00:00 UTC)
    const todayRaces = races.filter((r) => {
      const ts = typeof r.timestamp === "number" ? r.timestamp : 0;
      return ts >= today00UTC;
    });

    // Multiplayer races ONLY for 10-race streak calculation
    const todayMultiplayerRaces = todayRaces.filter(isCompetitiveRace);

    const racesDoneToday = todayMultiplayerRaces.length;
    const racesRemaining = Math.max(0, this.targetRaces - racesDoneToday);

    const qotdDone = qotdDoneOverride || todayRaces.some((r) => r.mode?.toLowerCase().includes("qotd"));

    // Calculate Best WPM Today across all races today
    const wpmsToday = todayRaces.map((r) => r.wpm).filter((w) => typeof w === "number" && !isNaN(w) && w > 0);
    const bestWpmToday = wpmsToday.length > 0 ? Math.max(...wpmsToday) : null;

    const secondsUntilReset = this.getSecondsUntilReset();
    const formattedCountdown = formatCountdown(secondsUntilReset);

    return {
      racesDoneToday,
      racesRemaining,
      targetDaily: this.targetRaces,
      qotdDone,
      bestWpmToday,
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
