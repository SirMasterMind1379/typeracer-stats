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
    const n = chronological.length;

    // Calculate line chart dynamic min/max with padding for vertical expansion
    const wpms = recent10.map((r) => r.wpm);
    const rawMax = Math.max(...wpms);
    const rawMin = Math.min(...wpms);
    const span = rawMax - rawMin;
    const margin = Math.max(3, Math.round(span * 0.16));
    const maxWpm = rawMax + margin;
    const minWpm = Math.max(0, rawMin - margin);
    const avgWpmVal = (wpms.reduce((a, b) => a + b, 0) / wpms.length).toFixed(1);

    // SVG Line Chart Dimensions
    const svgWidth = 280;
    const svgHeight = 105;
    const paddingX = 16;
    const paddingY = 18;
    const chartW = svgWidth - 2 * paddingX;
    const chartH = svgHeight - 2 * paddingY;

    // Linear Regression Trendline (Slope & Intercept)
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = chronological[i].wpm;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1) : 0;
    const intercept = n > 1 ? (sumY - slope * sumX) / n : (wpms[0] || 0);

    const isTrendingUp = slope > 0.05;
    const isTrendingDown = slope < -0.05;
    const trendColor = isTrendingUp ? "#22c55e" : isTrendingDown ? "#f97316" : "#9ca3af";
    const netTrendChange = (slope * (n - 1)).toFixed(1);
    const trendBadgeHtml = n > 1
      ? isTrendingUp
        ? `<span style="color: #22c55e; font-size: 10px; font-weight: 700; margin-left: 6px;" title="Trendline: +${netTrendChange} WPM">▲ +${netTrendChange}</span>`
        : isTrendingDown
          ? `<span style="color: #f97316; font-size: 10px; font-weight: 700; margin-left: 6px;" title="Trendline: ${netTrendChange} WPM">▼ ${netTrendChange}</span>`
          : `<span style="color: #9ca3af; font-size: 10px; font-weight: 600; margin-left: 6px;" title="Trendline: Flat">― Flat</span>`
      : "";

    // Calculate (x, y) coordinates for polyline
    const points = chronological.map((r, i) => {
      const stepX = n > 1 ? chartW / (n - 1) : chartW / 2;
      const x = paddingX + i * stepX;
      const heightPercent = Math.max(0.02, Math.min(0.98, (r.wpm - minWpm) / (maxWpm - minWpm || 1)));
      const y = paddingY + (1 - heightPercent) * chartH;
      const url = this.buildTypeRacerResultUrl(r, username);
      return { x, y, wpm: r.wpm, accuracy: r.accuracy ?? 98.0, url, isNewest: i === n - 1 };
    });

    // Trendline Coordinates
    const trendStartSpeed = intercept;
    const trendEndSpeed = slope * (n - 1) + intercept;
    const trendPct0 = Math.max(0, Math.min(1, (trendStartSpeed - minWpm) / (maxWpm - minWpm || 1)));
    const trendPct1 = Math.max(0, Math.min(1, (trendEndSpeed - minWpm) / (maxWpm - minWpm || 1)));
    const trendY0 = paddingY + (1 - trendPct0) * chartH;
    const trendY1 = paddingY + (1 - trendPct1) * chartH;
    const trendX0 = points[0]?.x ?? paddingX;
    const trendX1 = points[points.length - 1]?.x ?? (svgWidth - paddingX);

    const trendlineSvg = n > 1 ? `
      <!-- Trendline (Green = Up, Orange = Down) -->
      <line x1="${trendX0.toFixed(1)}" y1="${trendY0.toFixed(1)}"
            x2="${trendX1.toFixed(1)}" y2="${trendY1.toFixed(1)}"
            stroke="${trendColor}" stroke-width="2" stroke-dasharray="5,3" opacity="0.85" />
    ` : "";

    // Average horizontal reference line
    const avgPct = Math.max(0, Math.min(1, (Number(avgWpmVal) - minWpm) / (maxWpm - minWpm || 1)));
    const avgY = paddingY + (1 - avgPct) * chartH;
    const avgGridlineSvg = `
      <line x1="${paddingX}" y1="${avgY.toFixed(1)}" x2="${svgWidth - paddingX}" y2="${avgY.toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2" />
    `;

    // Build SVG Path Strings
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${svgHeight} L ${points[0].x.toFixed(1)},${svgHeight} Z`;

    // Data Point Circle Markers & Labels
    const circlesSvg = points.map((p) => {
      const circleR = p.isNewest ? 4.5 : 3.5;
      const strokeW = p.isNewest ? 2 : 1.5;
      return `
        <a href="${p.url}" target="_blank" rel="noopener" class="tr-point-group">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${circleR}" fill="${p.isNewest ? '#ffffff' : '#ef4444'}" stroke="#9e1b24" stroke-width="${strokeW}" />
          <text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="8.5" fill="${p.isNewest ? '#ffffff' : '#d1d5db'}" text-anchor="middle" font-weight="${p.isNewest ? '800' : '600'}">${p.wpm.toFixed(1)}</text>
        </a>
      `;
    }).join("");

    // Build List Items (WPM with 1 decimal digit, valid Text ID link or clean em-dash)
    const listHtml = recent10.map((r, index) => {
      const isNew = index === 0 && highlightNew;
      const raceUrl = this.buildTypeRacerResultUrl(r, username);

      const tidHtml = r.textId && r.textId > 0
        ? `<a href="https://data.typeracer.com/pit/text_info?id=${r.textId}" target="_blank" rel="noopener" class="tr-tid-link" title="View quote text info on TypeRacer">#${r.textId}</a>`
        : `<span class="tr-tid-muted">&mdash;</span>`;

      const accVal = (r.accuracy ?? 98.0).toFixed(1);

      return `
        <div class="tr-race-item ${isNew ? 'new-item' : ''}">
          <span class="tr-race-wpm">${r.wpm.toFixed(1)} WPM <span style="font-size: 10px; opacity: 0.65; font-weight: 500;">(${accVal}%)</span></span>
          ${tidHtml}
          <a href="${raceUrl}" target="_blank" rel="noopener" class="tr-race-link" title="View pit result details">Result ↗</a>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">
          <span>Multiplayer Progression ${trendBadgeHtml}</span>
          <span style="color: #ef4444; font-weight: 700;">Avg: ${avgWpmVal} WPM</span>
        </div>

        <div class="tr-sparkline-box">
          <svg class="tr-sparkline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <defs>
              <linearGradient id="trLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
              </linearGradient>
            </defs>

            <!-- Background Gridline -->
            ${avgGridlineSvg}

            <!-- Line Area Fill -->
            <path d="${areaD}" fill="url(#trLineGrad)" />

            <!-- Trendline -->
            ${trendlineSvg}

            <!-- Polyline Path -->
            <path d="${pathD}" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" />

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
