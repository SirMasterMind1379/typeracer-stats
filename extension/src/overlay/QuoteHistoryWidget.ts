import type { ExtensionRace, QuoteHistoryRecord } from "../types";

export class QuoteHistoryWidget {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public renderPreRaceQuote(record: QuoteHistoryRecord | null, quoteText: string): void {
    if (!quoteText) {
      this.container.innerHTML = "";
      return;
    }

    if (!record || record.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-quote-banner new-text">
            <strong>🆕 New Text</strong> — First time typing this quote!
          </div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-quote-banner repeat-text">
          <strong>🔁 Previously Typed (${record.timesTyped}x)</strong>
          <div class="tr-quote-stats">
            <span>Last: <strong>${record.lastSpeed.toFixed(1)} WPM</strong> (${record.lastAccuracy.toFixed(1)}%)</span>
            <span>Best: <strong>${record.bestSpeed.toFixed(1)} WPM</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  public renderPostRaceDelta(newRace: ExtensionRace, previousRecord: QuoteHistoryRecord | null): void {
    if (!previousRecord || previousRecord.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-quote-banner new-text">
            ✨ First completion saved! Baseline: <strong>${newRace.speed.toFixed(1)} WPM</strong> (${newRace.accuracy.toFixed(1)}% Acc).
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
        <div class="tr-delta-pill ${pillClass}">
          <span>${icon} <strong>${sign}${wpmDiff.toFixed(1)} WPM</strong> vs last time (${previousRecord.lastSpeed.toFixed(1)} WPM)${accText}</span>
        </div>
      </div>
    `;
  }

  public clear(): void {
    this.container.innerHTML = "";
  }
}
