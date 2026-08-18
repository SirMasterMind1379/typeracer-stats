import type { StreakInfo } from "../types";

export class StreakWidget {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(info: StreakInfo): void {
    const pct = Math.min(100, Math.round((info.racesDoneToday / info.targetDaily) * 100));
    const isStreakDone = info.racesDoneToday >= info.targetDaily;

    const valClass = isStreakDone ? "tr-streak-val complete" : "tr-streak-val";
    const fillClass = isStreakDone ? "tr-progress-fill complete" : "tr-progress-fill";

    const qotdBadge = info.qotdDone
      ? `<span class="tr-badge done">Completed ✓</span>`
      : `<span class="tr-badge pending">Pending ❌</span>`;

    const bestTodayText = info.bestWpmToday != null ? `Best Today: <strong>${info.bestWpmToday.toFixed(1)} WPM</strong>` : "Best Today: --";
    const bestQotdText = info.bestQotdToday != null ? `Best QOTD: <strong>${info.bestQotdToday.toFixed(1)} WPM</strong>` : "Best QOTD: --";
    const remainingText = info.racesRemaining > 0 ? `${info.racesRemaining} more needed` : "Goal reached!";
    const dayStreakText = `🔥 ${info.currentDayStreak}d streak`;

    // If card already exists, update elements in place to prevent layout blink
    const streakValEl = this.container.querySelector(".tr-streak-val");
    const progressFillEl = this.container.querySelector(".tr-progress-fill") as HTMLElement | null;
    const badgeEl = this.container.querySelector(".tr-badge");
    const timerEl = this.container.querySelector(".tr-timer");
    const bestEl = this.container.querySelector("#tr-best-today-label");
    const bestQotdEl = this.container.querySelector("#tr-best-qotd-label");
    const remainingEl = this.container.querySelector("#tr-remaining-label");
    const dayStreakEl = this.container.querySelector("#tr-day-streak-badge");

    if (streakValEl && progressFillEl && badgeEl && timerEl && bestEl && bestQotdEl && remainingEl && dayStreakEl) {
      streakValEl.className = valClass;
      streakValEl.textContent = `${info.racesDoneToday} / ${info.targetDaily}`;
      progressFillEl.className = fillClass;
      progressFillEl.style.width = `${pct}%`;
      badgeEl.className = info.qotdDone ? "tr-badge done" : "tr-badge pending";
      badgeEl.textContent = info.qotdDone ? "Completed ✓" : "Pending ❌";
      timerEl.textContent = info.formattedCountdown;
      bestEl.innerHTML = bestTodayText;
      bestQotdEl.innerHTML = bestQotdText;
      remainingEl.textContent = remainingText;
      dayStreakEl.textContent = dayStreakText;
      return;
    }

    this.container.innerHTML = `
      <div class="tr-card">
        <!-- 1. Multiplayer 10-Race Daily Streak Section -->
        <div class="tr-streak-header">
          <span class="tr-card-title" style="margin-bottom: 0; display: flex; align-items: center; gap: 6px;">
            Daily 10-Race Streak
            <span class="tr-day-streak-badge" id="tr-day-streak-badge" title="Consecutive days with 10+ completed multiplayer races">${dayStreakText}</span>
          </span>
          <span class="${valClass}">${info.racesDoneToday} / ${info.targetDaily}</span>
        </div>

        <div class="tr-progress-bg">
          <div class="${fillClass}" style="width: ${pct}%;"></div>
        </div>

        <div class="tr-status-row" style="margin-top: 4px;">
          <span style="font-size: 11px; color: #fbbf24;" id="tr-best-today-label">${bestTodayText}</span>
          <span style="font-size: 10px; color: #9ca3af;" id="tr-remaining-label">${remainingText}</span>
        </div>

        <!-- 2. Quote of the Day (QOTD) Section -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 8px; padding-top: 8px;">
          <div class="tr-status-row">
            <span style="font-weight: 600;">Quote of the Day (QOTD)</span>
            ${qotdBadge}
          </div>
          <div class="tr-status-row" style="margin-top: 4px;">
            <span style="font-size: 11px; color: #38bdf8;" id="tr-best-qotd-label">${bestQotdText}</span>
            <span class="tr-timer" title="Time until UTC reset">${info.formattedCountdown}</span>
          </div>
        </div>
      </div>
    `;
  }
}
