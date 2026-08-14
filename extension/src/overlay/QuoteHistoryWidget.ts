import type { ExtensionRace, QuoteHistoryRecord } from "../types";

export class QuoteHistoryWidget {
  private container: HTMLElement;
  private activeRaceId: string | null = null;
  private activeType: "pre" | "post" | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public renderPreRaceQuote(record: QuoteHistoryRecord | null, quoteText: string): void {
    this.activeRaceId = null;
    this.activeType = "pre";

    if (!quoteText) {
      this.container.innerHTML = "";
      return;
    }

    if (!record || record.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">Quote History</div>
          <div class="tr-quote-banner new-text">
            <strong>🆕 New Quote</strong> &mdash; First time encountering this text.
          </div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Quote History</span>
          <span style="font-size: 10px; color: #fbbf24; font-weight: 700;">Typed ${record.timesTyped}x</span>
        </div>
        <div class="tr-quote-banner repeat-text">
          <div class="tr-quote-stats" style="margin-top: 0; justify-content: space-between;">
            <span>Last Attempt: <strong>${record.lastSpeed.toFixed(1)} WPM</strong> (${record.lastAccuracy.toFixed(1)}%)</span>
            <span>Best: <strong>${record.bestSpeed.toFixed(1)} WPM</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  public renderPostRaceDelta(newRace: ExtensionRace, previousRecord: QuoteHistoryRecord | null): void {
    this.activeRaceId = newRace.id || null;
    this.activeType = "post";

    if (!previousRecord || previousRecord.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">Quote History</div>
          <div class="tr-quote-banner new-text">
            ✨ <strong>New quote recorded!</strong> Baseline saved: <strong>${newRace.speed.toFixed(1)} WPM</strong> (${newRace.accuracy.toFixed(1)}% Acc).
          </div>
        </div>
      `;
      return;
    }

    const wpmDiff = Number((newRace.speed - previousRecord.lastSpeed).toFixed(1));
    const accDiff = Number((newRace.accuracy - previousRecord.lastAccuracy).toFixed(1));

    const isGain = wpmDiff >= 0;
    const pillClass = isGain ? "gain" : "loss";
    const icon = isGain ? "🚀" : "📉";
    const sign = wpmDiff > 0 ? "+" : "";

    const accSign = accDiff > 0 ? "+" : "";
    const accText = accDiff !== 0 ? ` | Acc: ${accSign}${accDiff}%` : "";

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Quote Performance Delta</span>
          <span style="font-size: 10px; color: ${isGain ? '#22c55e' : '#ef4444'}; font-weight: 700;">Attempt #${previousRecord.timesTyped + 1}</span>
        </div>
        <div class="tr-delta-pill ${pillClass}">
          <span>${icon} <strong>${sign}${wpmDiff.toFixed(1)} WPM</strong> vs previous attempt (${previousRecord.lastSpeed.toFixed(1)} WPM)${accText}</span>
        </div>
      </div>
    `;
  }

  public validateAgainstLatestRace(latestRaceId?: string): void {
    if (this.activeType === "post" && this.activeRaceId && latestRaceId && this.activeRaceId !== latestRaceId) {
      this.clear();
    }
  }

  public clear(): void {
    this.activeRaceId = null;
    this.activeType = null;
    this.container.innerHTML = "";
  }
}
