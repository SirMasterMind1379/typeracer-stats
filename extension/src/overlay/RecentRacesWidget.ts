import type { ExtensionRace } from "../types";
import { isCompetitiveRace } from "../types";

export class RecentRacesWidget {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private buildTypeRacerResultUrl(race: ExtensionRace, username: string): string {
    const user = username || "local_user";
    const idStr = String(race.id || "").trim();

    if (idStr.startsWith("|tr:")) {
      return `https://data.typeracer.com/pit/result?id=${idStr}`;
    }
    if (idStr.startsWith("tr:")) {
      return `https://data.typeracer.com/pit/result?id=|${idStr}`;
    }
    if (idStr.includes("|")) {
      return `https://data.typeracer.com/pit/result?id=${idStr}`;
    }

    const numMatch = idStr.match(/\d+/);
    const raceNum = numMatch ? numMatch[0] : idStr;

    return `https://data.typeracer.com/pit/result?id=|tr:${encodeURIComponent(user)}|${raceNum}`;
  }

  public render(races: ExtensionRace[], highlightNew = false, username = ""): void {
    // Filter multiplayer races ONLY (excluding QOTD & solo)
    const mpRaces = races.filter(isCompetitiveRace);
    const recent10 = mpRaces.slice(0, 10);

    if (recent10.length === 0) {
      this.container.innerHTML = `
        <div class="tr-card">
          <div class="tr-card-title">Multiplayer Progression (Last 10)</div>
          <div style="color: #9ca3af; font-size: 11px; text-align: center; padding: 10px;">
            No multiplayer races recorded yet. Complete a race to see live stats!
          </div>
        </div>
      `;
      return;
    }

    // Chronological order for left-to-right line chart progression (Oldest -> Newest)
    const chronological = [...recent10].reverse();

    // Calculate line chart min/max
    const wpms = recent10.map((r) => r.speed);
    const maxWpm = Math.max(...wpms, 120);
    const minWpm = Math.max(0, Math.min(...wpms) - 10);

    // SVG Line Chart Dimensions
    const svgWidth = 280;
    const svgHeight = 60;
    const paddingX = 14;
    const paddingY = 16;
    const chartW = svgWidth - 2 * paddingX;
    const chartH = svgHeight - 2 * paddingY;

    // Calculate (x, y) coordinates for polyline
    const points = chronological.map((r, i) => {
      const stepX = chronological.length > 1 ? chartW / (chronological.length - 1) : chartW / 2;
      const x = paddingX + i * stepX;
      const heightPercent = Math.max(0.05, (r.speed - minWpm) / (maxWpm - minWpm || 1));
      const y = paddingY + (1 - heightPercent) * chartH;
      const url = this.buildTypeRacerResultUrl(r, username);
      return { x, y, speed: r.speed, accuracy: r.accuracy, url, isNewest: i === chronological.length - 1 };
    });

    // Build SVG Path Strings
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${svgHeight} L ${points[0].x.toFixed(1)},${svgHeight} Z`;

    // Data Point Circle Markers & Labels (Clickable Links)
    const circlesSvg = points.map((p) => {
      const circleR = p.isNewest ? 4.5 : 3.5;
      const strokeW = p.isNewest ? 2 : 1.5;
      return `
        <a href="${p.url}" target="_blank" rel="noopener" class="tr-point-group">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${circleR}" fill="${p.isNewest ? '#ffffff' : '#ef4444'}" stroke="#9e1b24" stroke-width="${strokeW}" />
          <text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="8" fill="${p.isNewest ? '#ffffff' : '#d1d5db'}" text-anchor="middle" font-weight="${p.isNewest ? '800' : '600'}">${p.speed}</text>
        </a>
      `;
    }).join("");

    // Build List Items (WPM | Clickable Text ID Link | Clickable Result Link)
    const listHtml = recent10.map((r, index) => {
      const isNew = index === 0 && highlightNew;
      const raceUrl = this.buildTypeRacerResultUrl(r, username);
      const textIdText = r.textId ? `#${r.textId}` : "#--";
      const textInfoUrl = r.textId ? `https://data.typeracer.com/pit/text_info?id=${r.textId}` : "javascript:void(0)";

      return `
        <div class="tr-race-item ${isNew ? 'new-item' : ''}">
          <span class="tr-race-wpm">⚡ ${r.speed} WPM <span style="font-size: 10px; opacity: 0.65; font-weight: 500;">(${r.accuracy.toFixed(1)}%)</span></span>
          <a href="${textInfoUrl}" target="_blank" rel="noopener" class="tr-tid-link" title="View quote text info on TypeRacer">${textIdText}</a>
          <a href="${raceUrl}" target="_blank" rel="noopener" class="tr-race-link" title="View pit result details">Result ↗</a>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Multiplayer Progression</span>
          <span style="color: #ef4444; font-weight: 700;">Avg: ${Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length)} WPM</span>
        </div>

        <div class="tr-sparkline-box">
          <svg class="tr-sparkline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <defs>
              <linearGradient id="trLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
              </linearGradient>
            </defs>

            <!-- Line Area Fill -->
            <path d="${areaD}" fill="url(#trLineGrad)" />

            <!-- Polyline Path -->
            <path d="${pathD}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />

            <!-- Point Dots & Speed Labels -->
            ${circlesSvg}
          </svg>
        </div>

        <div class="tr-races-list" style="margin-top: 8px;">
          ${listHtml}
        </div>
      </div>
    `;
  }
}
