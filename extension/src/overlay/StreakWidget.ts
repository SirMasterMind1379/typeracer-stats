import type { StreakInfo } from "../types";

export class StreakWidget {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(info: StreakInfo): void {
    const pct = Math.min(100, Math.round((info.racesDoneToday / info.targetDaily) * 100));
    const isStreakDone = info.racesRemaining === 0;

    const streakMsg = isStreakDone
      ? "🔥 Daily 10-race streak complete! Great work!"
      : `🎯 <strong>${info.racesRemaining}</strong> more race${info.racesRemaining > 1 ? "s" : ""} to complete daily streak!`;

    const qotdBadge = info.qotdDone
      ? `<span class="tr-badge done">Completed ✓</span>`
      : `<span class="tr-badge pending">Pending ❌</span>`;

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-streak-header">
          <span class="tr-card-title" style="margin-bottom: 0;">Daily 10-Race Streak</span>
          <span class="tr-streak-val">${info.racesDoneToday} / ${info.targetDaily}</span>
        </div>

        <div class="tr-progress-bg">
          <div class="tr-progress-fill" style="width: ${pct}%;"></div>
        </div>

        <div class="tr-streak-msg">${streakMsg}</div>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 8px; padding-top: 8px;">
          <div class="tr-status-row">
            <span>Quote of the Day (QOTD)</span>
            ${qotdBadge}
          </div>
          <div class="tr-status-row">
            <span>Day Reset Countdown</span>
            <span class="tr-timer">${info.formattedCountdown}</span>
          </div>
        </div>
      </div>
    `;
  }
}
