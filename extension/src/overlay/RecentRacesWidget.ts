import type { ExtensionRace } from "../types";

export class RecentRacesWidget {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(races: ExtensionRace[], highlightNew = false): void {
    const displayRaces = races.slice(0, 10);

    if (displayRaces.length === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">Last 10 Races</div>
          <div style="color: #9ca3af; font-size: 11px; text-align: center; padding: 10px;">
            No races recorded yet. Complete a race to see live stats!
          </div>
        </div>
      `;
      return;
    }

    // Calculate sparkline min/max
    const wpms = displayRaces.map((r) => r.speed);
    const maxWpm = Math.max(...wpms, 120);
    const minWpm = Math.max(0, Math.min(...wpms) - 10);

    // Build SVG Sparkline bars
    const barWidth = 24;
    const gap = 4;
    const svgWidth = displayRaces.length * (barWidth + gap);
    const svgHeight = 36;

    const barsSvg = displayRaces.map((r, i) => {
      const heightPercent = Math.max(0.15, (r.speed - minWpm) / (maxWpm - minWpm || 1));
      const barH = Math.max(4, Math.round(heightPercent * svgHeight));
      const x = i * (barWidth + gap);
      const y = svgHeight - barH;
      const color = r.won ? "#4ade80" : r.speed >= 100 ? "#ef4444" : "#f97316";

      return `
        <g class="tr-bar-group" data-wpm="${r.speed}">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="${color}" opacity="0.85">
            <animate attributeName="height" from="0" to="${barH}" dur="0.35s" fill="freeze" />
            <animate attributeName="y" from="${svgHeight}" to="${y}" dur="0.35s" fill="freeze" />
          </rect>
          <text x="${x + barWidth / 2}" y="${y - 3}" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="600">${r.speed}</text>
        </g>
      `;
    }).join("");

    // Build list items
    const listHtml = displayRaces.map((r, index) => {
      const isNew = index === 0 && highlightNew;
      const rankText = r.won ? "1st 🏆" : `#${r.rank}`;
      const rankClass = r.won ? "win" : "";

      return `
        <div class="tr-race-item ${isNew ? 'new-item' : ''}">
          <span class="tr-race-num">#${displayRaces.length - index}</span>
          <span class="tr-race-wpm">${r.speed} WPM</span>
          <span class="tr-race-acc">${r.accuracy.toFixed(1)}%</span>
          <span class="tr-race-rank ${rankClass}">${rankText}</span>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Recent Progress (Last ${displayRaces.length})</span>
          <span style="color: #ef4444; font-weight: 700;">Avg: ${Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length)} WPM</span>
        </div>

        <div class="tr-sparkline-box">
          <svg class="tr-sparkline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
            ${barsSvg}
          </svg>
        </div>

        <div class="tr-races-list" style="margin-top: 8px;">
          ${listHtml}
        </div>
      </div>
    `;
  }
}
