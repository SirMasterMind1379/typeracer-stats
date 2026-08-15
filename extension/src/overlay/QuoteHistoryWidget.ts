import type { ExtensionRace, QuoteHistoryRecord } from "../types";

export class QuoteHistoryWidget {
  private container: HTMLElement;
  private activeRaceId: string | number | null = null;
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

    const tidHtml = record?.textId && record.textId > 0
      ? `<a href="https://data.typeracer.com/pit/text_info?id=${record.textId}" target="_blank" rel="noopener" class="tr-tid-link" title="View text info">#${record.textId}</a>`
      : "";

    if (!record || record.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">
            <span>Quote Recognition</span>
            ${tidHtml}
          </div>
          <div class="tr-quote-banner new-text">
            <strong>🆕 First Encounter</strong> &mdash; This text has not been typed in your recorded history.
          </div>
        </div>
      `;
      return;
    }

    const timesLabel = record.timesTyped === 1 ? "1 Previous Attempt" : `${record.timesTyped} Previous Attempts`;

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Quote Recognition ${tidHtml}</span>
          <span style="font-size: 10px; color: #fbbf24; font-weight: 700;">🔁 ${timesLabel}</span>
        </div>
        <div class="tr-quote-banner repeat-text">
          <div class="tr-quote-stats" style="margin-top: 0; justify-content: space-between;">
            <span>Last Attempt: <strong>${record.lastSpeed.toFixed(1)} WPM</strong> (${record.lastAccuracy.toFixed(1)}%)</span>
            <span>Personal Best: <strong style="color: #22c55e;">${record.bestSpeed.toFixed(1)} WPM</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  public renderPostRaceDelta(newRace: ExtensionRace, previousRecord: QuoteHistoryRecord | null): void {
    this.activeRaceId = newRace.id || null;
    this.activeType = "post";

    const newAcc = newRace.accuracy ?? 98.0;
    const tidHtml = newRace.textId && newRace.textId > 0
      ? `<a href="https://data.typeracer.com/pit/text_info?id=${newRace.textId}" target="_blank" rel="noopener" class="tr-tid-link" title="View text info">#${newRace.textId}</a>`
      : "";

    // Truly first time completion (no previous history)
    if (!previousRecord || previousRecord.timesTyped === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">
            <span>Quote Performance ${tidHtml}</span>
            <span style="font-size: 10px; color: #fbbf24; font-weight: 700;">✨ New Text Baseline</span>
          </div>
          <div class="tr-delta-pill gain" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;">
            <span>🌟 Baseline Established: <strong>${newRace.wpm.toFixed(1)} WPM</strong> (${newAcc.toFixed(1)}% Acc)</span>
          </div>
        </div>
      `;
      return;
    }

    const wpmDiff = Number((newRace.wpm - previousRecord.lastSpeed).toFixed(1));
    const accDiff = Number((newAcc - previousRecord.lastAccuracy).toFixed(1));

    const isGain = wpmDiff >= 0;
    const pillClass = isGain ? "gain" : "loss";
    const icon = isGain ? "🚀" : "📉";
    const sign = wpmDiff > 0 ? "+" : "";

    const accSign = accDiff > 0 ? "+" : "";
    const accText = accDiff !== 0 ? ` | Acc: ${accSign}${accDiff}%` : "";

    const attemptNumber = previousRecord.timesTyped + 1;

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Quote Performance Delta ${tidHtml}</span>
          <span style="font-size: 10px; color: ${isGain ? '#22c55e' : '#ef4444'}; font-weight: 700;">Attempt #${attemptNumber}</span>
        </div>
        <div class="tr-delta-pill ${pillClass}">
          <span>${icon} <strong>${sign}${wpmDiff.toFixed(1)} WPM</strong> vs previous attempt (${previousRecord.lastSpeed.toFixed(1)} WPM)${accText}</span>
        </div>
      </div>
    `;
  }

  public validateAgainstLatestRace(latestRaceId?: string | number): void {
    if (this.activeType === "post" && this.activeRaceId && latestRaceId && String(this.activeRaceId) !== String(latestRaceId)) {
      this.clear();
    }
  }

  public clear(): void {
    this.activeRaceId = null;
    this.activeType = null;
    this.container.innerHTML = "";
  }
}
