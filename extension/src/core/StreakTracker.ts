import type { ExtensionRace, StreakInfo } from "../types";

export class StreakTracker {
  private targetRaces = 10;

  public getTodayUTCDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public getSecondsUntilReset(): number {
    const now = new Date();
    const nextReset = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));
  }

  public formatSeconds(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  public calculateStreakInfo(races: ExtensionRace[], qotdDoneOverride = false): StreakInfo {
    const todayStr = this.getTodayUTCDateString();
    
    // Filter races completed today in UTC
    const todayRaces = races.filter((r) => {
      if (!r.date) return false;
      const raceDate = r.date.includes("T") ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
      return raceDate === todayStr;
    });

    const racesDoneToday = todayRaces.length;
    const racesRemaining = Math.max(0, this.targetRaces - racesDoneToday);

    const qotdDone = qotdDoneOverride || todayRaces.some((r) => r.mode?.toLowerCase().includes("qotd"));

    const secondsUntilReset = this.getSecondsUntilReset();
    const formattedCountdown = this.formatSeconds(secondsUntilReset);

    return {
      racesDoneToday,
      racesRemaining,
      targetDaily: this.targetRaces,
      qotdDone,
      secondsUntilReset,
      formattedCountdown,
    };
  }

  public isNotificationNeeded(streakInfo: StreakInfo): boolean {
    // Check if within 1 hour of reset (3600 seconds)
    const isWithinOneHour = streakInfo.secondsUntilReset <= 3600 && streakInfo.secondsUntilReset > 0;
    const streakIncomplete = streakInfo.racesRemaining > 0 || !streakInfo.qotdDone;
    return isWithinOneHour && streakIncomplete;
  }
}
