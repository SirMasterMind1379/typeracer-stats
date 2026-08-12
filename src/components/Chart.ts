import type { Metric } from "../types";
import { escapeHtml } from "../types";

export interface ChartProps {
  data: any[];
  selectedMetric: Metric;
  lineColor: string;
  regressionColor: string;
  regression: { slope: number; intercept: number; line: number[] } | null;
  onMouseDown: (ts: number) => void;
  onMouseMove: (ts: number) => void;
  onMouseUp: () => void;
  onResetZoom?: () => void;
  refAreaLeft: number | null;
  refAreaRight: number | null;
  formatDate: (dateStr: string) => string;
}

// Native high-performance SVG chart renderer with:
// 1. In-place zoom selection overlay
// 2. Vertical crosshair line + detailed data point hover tooltip panel
// 3. Mobile touch drag-to-zoom, pinch, and tap-to-reset support
export function renderChart(props: ChartProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "w-full overflow-x-auto relative select-none cursor-crosshair touch-none";

  const {
    data,
    selectedMetric,
    lineColor,
    regressionColor,
    regression,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onResetZoom,
    refAreaLeft,
    refAreaRight,
    formatDate,
  } = props;

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-beige-600 dark:text-beige-400">No chart data available</div>`;
    return container;
  }

  const dataKey =
    selectedMetric === "speed" ? "speed"
    : selectedMetric === "accuracy" ? "accuracy"
    : selectedMetric === "points" ? "cumulativePoints"
    : "winsPer100";

  const W = 800;
  const H = 300;
  const M = { top: 25, right: 30, bottom: 50, left: 55 };
  const cW = W - M.left - M.right;
  const cH = H - M.top - M.bottom;

  const values = data.map((d) => Number(d[dataKey]) || 0);
  let minY = Math.min(...values);
  let maxY = Math.max(...values);

  if (selectedMetric === "accuracy") {
    minY = Math.max(0, Math.floor(minY - 2));
    maxY = 100;
  } else {
    const pad = (maxY - minY) * 0.1 || 5;
    minY = Math.max(0, Math.floor(minY - pad));
    maxY = Math.ceil(maxY + pad);
  }

  const rangeY = maxY - minY || 1;
  const getX = (i: number) => M.left + (i / (data.length - 1 || 1)) * cW;
  const getY = (v: number) => M.top + cH - ((v - minY) / rangeY) * cH;

  const yTicks = Array.from({ length: 5 }, (_, i) => minY + (rangeY / 4) * i);
  const step = Math.max(1, Math.floor(data.length / 8));
  const xIndices = Array.from({ length: Math.ceil(data.length / step) }, (_, i) => Math.min(i * step, data.length - 1));
  const linePoints = data.map((d, i) => `${getX(i)},${getY(d[dataKey])}`).join(" ");
  const regPoints = regression?.line.length === data.length
    ? data.map((_, i) => `${getX(i)},${getY(regression!.line[i])}`).join(" ")
    : "";

  // Build static SVG (grid, axes, series) — rendered once, never re-created during interaction
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "w-full h-auto font-mono text-[10px]");

  svg.innerHTML = `
    ${yTicks.map((tick) => `
      <line x1="${M.left}" y1="${getY(tick)}" x2="${W - M.right}" y2="${getY(tick)}" class="stroke-beige-300 dark:stroke-beige-800" stroke-dasharray="3 3" />
      <text x="${M.left - 8}" y="${getY(tick) + 3}" text-anchor="end" class="fill-beige-700 dark:fill-beige-400 font-sans text-[10px]">
        ${selectedMetric === "accuracy" ? tick.toFixed(0) + "%" : tick.toFixed(0)}
      </text>
    `).join("")}

    ${xIndices.map((idx) => {
      const d = data[idx];
      const x = getX(idx);
      const y = H - M.bottom + 15;
      return `
        <line x1="${x}" y1="${M.top}" x2="${x}" y2="${H - M.bottom}" class="stroke-beige-300 dark:stroke-beige-800" stroke-dasharray="2 2" opacity="0.5" />
        <text x="${x}" y="${y}" text-anchor="end" transform="rotate(-15, ${x}, ${y})" class="fill-beige-700 dark:fill-beige-400 text-[9px] font-sans">
          ${d.dateLabel || formatDate(d.date)}
        </text>
      `;
    }).join("")}

    ${selectedMetric === "wins"
      ? data.map((d, i) => {
          const x = getX(i) - 2;
          const y = getY(d.winsPer100);
          const h = H - M.bottom - y;
          return `<rect x="${x}" y="${y}" width="4" height="${Math.max(0, h)}" fill="${lineColor}" opacity="0.8" class="animate-bar-grow" />`;
        }).join("")
      : `<polyline pathLength="1" class="animate-line-draw" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${linePoints}" />`
    }

    ${regPoints ? `<polyline pathLength="1" class="animate-line-draw" fill="none" stroke="${regressionColor}" stroke-width="2" stroke-dasharray="4 4" points="${regPoints}" />` : ""}

    <!-- Mutable overlay group for drag selection -->
    <g id="zoom-overlay"></g>

    <!-- Mutable crosshair group for hover tooltip -->
    <g id="crosshair-group"></g>
  `;

  // Helper to convert client X to nearest data index
  const getIdxFromClientX = (clientX: number): number => {
    const rect = svg.getBoundingClientRect();
    const mx = clientX - rect.left;
    const nx = (mx / rect.width) * W;
    const cx = Math.max(M.left, Math.min(W - M.right, nx));
    const ratio = (cx - M.left) / cW;
    return Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
  };

  const svgToTs = (clientX: number): number | null => {
    const idx = getIdxFromClientX(clientX);
    return data[idx]?.ts ?? null;
  };

  // Helper to find data point index closest to a timestamp
  const tsToIdx = (ts: number) => {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(data[i].ts - ts);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return best;
  };

  // 1. Zoom Selection Overlay Handler
  const updateOverlay = (leftTs: number | null, rightTs: number | null) => {
    const overlay = svg.getElementById("zoom-overlay")!;
    if (leftTs == null || rightTs == null) {
      overlay.innerHTML = "";
      return;
    }
    const idxL = tsToIdx(Math.min(leftTs, rightTs));
    const idxR = tsToIdx(Math.max(leftTs, rightTs));
    const x1 = getX(idxL);
    const x2 = getX(idxR);
    const selW = Math.abs(x2 - x1);
    if (selW < 3) { overlay.innerHTML = ""; return; }

    const slice = data.slice(idxL, idxR + 1);
    const sliceVals = slice.map((d) => Number(d[dataKey]) || 0);
    const avg = sliceVals.length ? (sliceVals.reduce((a, b) => a + b, 0) / sliceVals.length).toFixed(1) : "—";
    const unit = selectedMetric === "speed" ? " WPM" : selectedMetric === "accuracy" ? "%" : "";
    const startLbl = slice[0]?.dateLabel || formatDate(slice[0]?.date || "");
    const endLbl = slice[slice.length - 1]?.dateLabel || formatDate(slice[slice.length - 1]?.date || "");
    const badgeText = `${startLbl} – ${endLbl}  •  ${slice.length} races  •  Avg ${avg}${unit}`;

    const badgeW = 280;
    const badgeX = Math.max(M.left, Math.min(W - M.right - badgeW, x1));
    const badgeY = M.top - 22;

    overlay.innerHTML = `
      <rect x="${x1}" y="${M.top}" width="${selW}" height="${cH}" fill="#b91c1c" opacity="0.18" stroke="#b91c1c" stroke-width="1.5" stroke-dasharray="3 3" />
      <line x1="${x1}" y1="${M.top}" x2="${x1}" y2="${M.top + cH}" stroke="#ef4444" stroke-width="1.5" opacity="0.9" />
      <line x1="${x2}" y1="${M.top}" x2="${x2}" y2="${M.top + cH}" stroke="#ef4444" stroke-width="1.5" opacity="0.9" />
      <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="18" rx="3" fill="#742a2a" opacity="0.97" stroke="#c53030" stroke-width="1" />
      <text x="${badgeX + badgeW / 2}" y="${badgeY + 12}" text-anchor="middle" fill="#fdfbf7" font-size="9" font-family="ui-monospace, monospace">${escapeHtml(badgeText)}</text>
    `;
  };

  updateOverlay(refAreaLeft, refAreaRight);

  // 2. Crosshair + Data Point Tooltip Handler
  const updateCrosshair = (clientX: number | null) => {
    const group = svg.getElementById("crosshair-group");
    if (!group) return;

    if (clientX == null || dragging) {
      group.innerHTML = "";
      return;
    }

    const idx = getIdxFromClientX(clientX);
    const item = data[idx];
    if (!item) { group.innerHTML = ""; return; }

    const x = getX(idx);
    const val = item[dataKey];
    const y = getY(val);

    const valLabel =
      selectedMetric === "speed" ? `${item.speed ?? val} WPM`
      : selectedMetric === "accuracy" ? `${(item.accuracy ?? val).toFixed(1)}%`
      : selectedMetric === "points" ? `${item.cumulativePoints ?? val} Pts`
      : `${item.winsPer100 ?? val} Wins/100`;

    const dateStr = item.dateLabel || formatDate(item.date || "");
    const accStr = item.accuracy != null ? `${item.accuracy.toFixed(1)}%` : null;
    const rankStr = item.rank && item.totalRacers ? `#${item.rank} / ${item.totalRacers}` : item.rank ? `#${item.rank}` : null;
    const modeStr = item.mode ? item.mode.toUpperCase() : null;

    // Build Tooltip Card Lines
    const lines = [
      { text: `${valLabel}`, bold: true, color: "#fdfbf7" },
      { text: `Date: ${dateStr}`, bold: false, color: "#e2d9c3" },
    ];
    if (accStr && selectedMetric !== "accuracy") lines.push({ text: `Acc: ${accStr}`, bold: false, color: "#e2d9c3" });
    if (rankStr) lines.push({ text: `Rank: ${rankStr}`, bold: false, color: "#e2d9c3" });
    if (modeStr) lines.push({ text: `Mode: ${modeStr}`, bold: false, color: "#e2d9c3" });

    // Panel geometry
    const boxW = 140;
    const boxH = 14 + lines.length * 13;
    let boxX = x + 12;
    let boxY = y - boxH / 2;

    // Flip if near right border
    if (boxX + boxW > W - M.right) {
      boxX = x - boxW - 12;
    }
    // Clamp vertical
    boxY = Math.max(M.top, Math.min(H - M.bottom - boxH, boxY));

    group.innerHTML = `
      <!-- Vertical Crosshair Line -->
      <line x1="${x}" y1="${M.top}" x2="${x}" y2="${M.top + cH}" stroke="${lineColor}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.85" />
      
      <!-- Snapped Point Highlight Circle -->
      <circle cx="${x}" cy="${y}" r="4.5" fill="${lineColor}" stroke="#fdfbf7" stroke-width="2" />

      <!-- Floating Tooltip Card -->
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" fill="#2b271e" opacity="0.95" stroke="#6b614d" stroke-width="1" />
      
      ${lines.map((l, i) => `
        <text
          x="${boxX + 8}"
          y="${boxY + 14 + i * 13}"
          fill="${l.color}"
          font-size="9.5"
          font-weight="${l.bold ? "bold" : "normal"}"
          font-family="ui-sans-serif, system-ui, sans-serif"
        >
          ${escapeHtml(l.text)}
        </text>
      `).join("")}
    `;
  };

  // Drag State Tracking
  let dragging = false;
  let startClientX = 0;
  let startClientY = 0;
  let dragLeftTs: number | null = null;

  svg.addEventListener("mousemove", (e) => {
    if (!dragging) {
      updateCrosshair(e.clientX);
    }
  });

  svg.addEventListener("mouseleave", () => {
    updateCrosshair(null);
  });

  svg.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    updateCrosshair(null);
    startClientX = e.clientX;
    startClientY = e.clientY;
    dragLeftTs = svgToTs(e.clientX);
    if (dragLeftTs != null) onMouseDown(dragLeftTs);
  });

  const onDocMove = (e: MouseEvent) => {
    if (!dragging || dragLeftTs == null) return;
    const ts = svgToTs(e.clientX);
    if (ts != null) {
      onMouseMove(ts);
      updateOverlay(dragLeftTs, ts);
    }
  };

  const onDocUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onDocMove);
    document.removeEventListener("mouseup", onDocUp);

    const dist = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);
    if (dist < 5) {
      updateOverlay(null, null);
      if (onResetZoom) onResetZoom();
    } else {
      updateOverlay(null, null);
      onMouseUp();
    }
  };

  svg.addEventListener("mousedown", () => {
    document.addEventListener("mousemove", onDocMove);
    document.addEventListener("mouseup", onDocUp);
  });

  // 3. Touch Gesture Handling (Drag Zoom, Pinch Zoom, Tap Reset)
  let touchStartDist = 0;
  let touchStartLeftTs: number | null = null;

  svg.addEventListener("touchstart", (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragging = true;
      updateCrosshair(null);
      startClientX = touch.clientX;
      startClientY = touch.clientY;
      dragLeftTs = svgToTs(touch.clientX);
      if (dragLeftTs != null) onMouseDown(dragLeftTs);
    } else if (e.touches.length === 2) {
      // Pinch gesture start
      dragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartLeftTs = svgToTs(Math.min(t1.clientX, t2.clientX));
      const touchRightTs = svgToTs(Math.max(t1.clientX, t2.clientX));
      if (touchStartLeftTs != null && touchRightTs != null) {
        onMouseDown(touchStartLeftTs);
        onMouseMove(touchRightTs);
        updateOverlay(touchStartLeftTs, touchRightTs);
      }
    }
  }, { passive: true });

  svg.addEventListener("touchmove", (e: TouchEvent) => {
    if (e.touches.length === 1 && dragging && dragLeftTs != null) {
      const touch = e.touches[0];
      const ts = svgToTs(touch.clientX);
      if (ts != null) {
        onMouseMove(ts);
        updateOverlay(dragLeftTs, ts);
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const leftTs = svgToTs(Math.min(t1.clientX, t2.clientX));
      const rightTs = svgToTs(Math.max(t1.clientX, t2.clientX));
      if (leftTs != null && rightTs != null) {
        onMouseMove(rightTs);
        updateOverlay(leftTs, rightTs);
      }
    }
  }, { passive: true });

  svg.addEventListener("touchend", (e: TouchEvent) => {
    if (dragging) {
      dragging = false;
      const changed = e.changedTouches[0];
      const dist = changed ? Math.hypot(changed.clientX - startClientX, changed.clientY - startClientY) : 0;
      if (dist < 8) {
        updateOverlay(null, null);
        if (onResetZoom) onResetZoom();
      } else {
        updateOverlay(null, null);
        onMouseUp();
      }
    }
  }, { passive: true });

  container.appendChild(svg);
  return container;
}
