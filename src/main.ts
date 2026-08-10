import "./index.css";
import { renderHeader } from "./components/Header";
import { renderSearchForm } from "./components/SearchForm";
import { renderDataImport } from "./components/DataImport";
import { renderUserProfile } from "./components/UserProfile";
import { renderStatsCards } from "./components/StatsCards";
import { renderTimeframeStats } from "./components/TimeframeStats";
import { renderChart } from "./components/Chart";
import { renderActivityHeatmap } from "./components/ActivityHeatmap";
import { renderRaceTable } from "./components/RaceTable";
import { renderExportButton } from "./components/ExportButton";
import { renderCsvExportButton } from "./components/CsvExportButton";
import { renderErrorBanner } from "./components/ErrorBanner";
import type { UserData, Race, Metric, TimeframeStats as TStats } from "./types";
import { formatDisplayDate, isCompetitiveRace, sortByDate, getCookie } from "./types";
import { getCachedRaces, saveCachedRaces, getCachedProfile, saveCachedProfile } from "./db";

const WINDOW = 100;
const raceLimitOptions = [1000, 500, 200, 100, 50, 20];

class App {
  /* ── State ── */
  private input = "";
  private apiKey = "";
  private data: UserData | null = null;
  private dataSource: "api" | "import" | "cache" | null = null;
  private fullRaces: Race[] = [];
  private loading = false;
  private error = "";

  private selectedMetric: Metric = "speed";
  private raceLimit: number | null = null;
  private dark = false;

  private refAreaLeft: number | null = null;
  private refAreaRight: number | null = null;
  private zoomBounds: { left: number; right: number } | null = null;

  private lastSubmitted = { username: "", apiKey: "" };

  private rootEl: HTMLElement;

  constructor() {
    this.rootEl = document.getElementById("app")!;
    this.input = getCookie("tr_username");
    this.apiKey = getCookie("tr_api_key");
    this.initTheme();
    this.render();
  }

  private initTheme() {
    const stored = localStorage.getItem("theme");
    // Default to light theme unless explicitly stored as "dark"
    this.dark = stored === "dark";
    document.documentElement.classList.toggle("dark", this.dark);
  }

  private toggleTheme = () => {
    this.dark = !this.dark;
    localStorage.setItem("theme", this.dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", this.dark);
    this.render();
  };

  private handleInputChange = (v: string) => {
    this.input = v;
  };

  private handleApiKeyChange = (v: string) => {
    this.apiKey = v;
  };

  private handleSubmit = async () => {
    this.loading = true;
    this.error = "";
    this.refAreaLeft = null;
    this.refAreaRight = null;
    this.zoomBounds = null;

    // Reset active dashboard state on new search
    this.data = null;
    this.fullRaces = [];
    this.dataSource = null;

    // Read current DOM input values
    const domUser = (document.getElementById("username-input") as HTMLInputElement)?.value;
    const domKey = (document.getElementById("apikey-input") as HTMLInputElement)?.value;
    let username = (domUser !== undefined ? domUser : this.input).trim();
    const key = (domKey !== undefined ? domKey : this.apiKey).trim();

    const match = username.match(/typeracer\.com\/pit\/(?:profile|racer)\?user=(\w+)/);
    if (match) username = match[1];

    if (!username) {
      this.error = "Please enter a username or profile link";
      this.loading = false;
      this.render();
      return;
    }

    // Privacy Guard: Load IndexedDB cache ONLY if user explicitly provides their API Key
    let cachedRaces: Race[] = [];
    if (key) {
      const cachedProfile = await getCachedProfile(username);
      cachedRaces = await getCachedRaces(username);
      if (cachedProfile && cachedRaces.length > 0) {
        this.data = cachedProfile;
        this.fullRaces = cachedRaces;
        this.dataSource = "cache";
      }
    }
    this.render();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const body: Record<string, string> = { username };
      if (key) {
        body.apiKey = key;
        body.apiUsername = username;
      }
      const res = await fetch("/api/user-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await res.json();
      if (!res.ok || result.error) {
        this.data = null;
        this.fullRaces = [];
        this.dataSource = null;
        this.error = result.error || `Server error (${res.status})`;
        this.loading = false;
        this.render();
        return;
      }

      const freshRaces: Race[] = result.races || [];
      const filteredFresh = freshRaces.filter((r: Race) => isCompetitiveRace(r));

      // Delta Merge with IndexedDB Cache ONLY if key is present
      let mergedRaces = filteredFresh;
      if (key) {
        const raceMap = new Map<string, Race>();
        for (const r of cachedRaces) raceMap.set(r.id, r);
        for (const r of filteredFresh) raceMap.set(r.id, r);
        mergedRaces = Array.from(raceMap.values());
        result.races = mergedRaces;

        // Persist to IndexedDB
        await saveCachedProfile(username, result);
        await saveCachedRaces(username, mergedRaces);
      }

      this.data = result;
      this.fullRaces = mergedRaces;
      this.dataSource = result.note ? null : "api";
      this.lastSubmitted = { username: username, apiKey: key };
      this.input = username;
      this.apiKey = key;
    } catch (err: any) {
      if (!this.data) {
        if (err.name === "AbortError") {
          this.error = "Request timed out. Server may be restarting.";
        } else {
          this.error = `Network error: ${err.message}.`;
        }
      }
    } finally {
      this.loading = false;
      this.render();
      this.scrollToProfile();
    }
  };

  private handleImport = async (races: Race[], username: string) => {
    if (this.dataSource === "api") {
      this.error = "API data has priority. Clear the search to use import data.";
      this.render();
      return;
    }
    this.error = "";
    this.refAreaLeft = null;
    this.refAreaRight = null;
    this.zoomBounds = null;
    this.input = username;

    const filtered = races.filter((r) => isCompetitiveRace(r));
    const sorted = sortByDate(filtered).map((r) => ({ ...r, date: r.date.replace(" ", "T") }));

    const total = sorted.length;
    const speeds = sorted.map((r) => r.speed);
    const avgWpm = speeds.reduce((s, v) => s + v, 0) / total || 0;
    const bestWpm = Math.max(...speeds) || 0;
    const totalPoints = sorted.reduce((s, r) => s + (r.points || 0), 0);
    const totalWins = sorted.filter((r) => r.won && isCompetitiveRace(r)).length;

    const allRaces = sortByDate(races).map((r) => ({ ...r, date: r.date.replace(" ", "T") }));

    const importedData: UserData = {
      username,
      name: username,
      joinedAt: null,
      premium: false,
      stats: { totalRaces: total, totalWins, points: totalPoints, avgWpm, bestWpm, typistLevel: null },
      races: sorted,
      qotdDone: false,
      note: "Imported from race export",
    };

    this.data = importedData;
    this.fullRaces = allRaces;
    this.dataSource = "import";

    this.render();
    this.scrollToProfile();
  };

  private handleClear = () => {
    this.data = null;
    this.dataSource = null;
    this.fullRaces = [];
    this.input = "";
    this.apiKey = "";
    this.error = "";
    this.refAreaLeft = null;
    this.refAreaRight = null;
    this.zoomBounds = null;
    this.render();
  };

  private resetZoom = () => {
    this.zoomBounds = null;
    this.refAreaLeft = null;
    this.refAreaRight = null;
    this.render();
  };

  private scrollToProfile() {
    setTimeout(() => {
      document.getElementById("user-profile-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  /* ── Calculations ── */
  private getDerivedData() {
    if (!this.data) return null;

    const useDateLabels = this.data.races.length > 0 && this.data.races.some((r) => !isNaN(new Date(r.date).getTime()));

    const allChartData = sortByDate(this.data.races).map((r, i) => ({
      ...r,
      dateLabel: useDateLabels ? formatDisplayDate(r.date) : `Race ${i + 1}`,
      ts: useDateLabels ? new Date(r.date).getTime() : i,
    }));

    const zoomedData = !this.zoomBounds || !useDateLabels
      ? allChartData
      : allChartData.filter((d) => d.ts >= this.zoomBounds!.left && d.ts <= this.zoomBounds!.right);

    const filteredData = this.raceLimit ? zoomedData.slice(-this.raceLimit) : zoomedData;

    const rollingData: any[] = [];
    let cp = 0;
    for (let i = 0; i < filteredData.length; i++) {
      const d = filteredData[i];
      const slice = filteredData.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const wins = slice.filter((r) => r.won && isCompetitiveRace(r)).length;
      cp += d.points || 0;
      rollingData.push({ ...d, speed: d.speed, accuracy: d.accuracy, winsPer100: +wins.toFixed(1), cumulativePoints: cp });
    }

    let regression: { slope: number; intercept: number; line: number[] } | null = null;
    if (rollingData.length >= 5 && this.selectedMetric !== "wins") {
      const key = this.selectedMetric === "speed" ? "speed" : "accuracy";
      const values = rollingData.map((d) => d[key]);
      const n = values.length;
      const indices = values.map((_, i) => i);
      const sumX = indices.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = indices.reduce((s, i) => s + i * values[i], 0);
      const sumX2 = indices.reduce((s, i) => s + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      regression = {
        slope,
        intercept,
        line: values.map((_, i) => +(intercept + slope * i).toFixed(1)),
      };
    }

    const timeframeStats: TStats | null = filteredData.length
      ? {
          races: filteredData.length,
          avgSpeed: (filteredData.reduce((s, r) => s + r.speed, 0) / filteredData.length).toFixed(1),
          avgAcc: (filteredData.reduce((s, r) => s + r.accuracy, 0) / filteredData.length).toFixed(1),
          wins: filteredData.filter((r) => r.won && isCompetitiveRace(r)).length,
          totalPoints: filteredData.reduce((s, r) => s + (r.points || 0), 0).toFixed(0),
          winRate: ((filteredData.filter((r) => r.won && isCompetitiveRace(r)).length / filteredData.length) * 100).toFixed(1),
        }
      : null;

    return { useDateLabels, rollingData, regression, timeframeStats };
  }

  /* ── Main Render Loop ── */
  private render() {
    this.rootEl.innerHTML = "";

    const container = document.createElement("div");
    container.className = "max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6";

    // Header
    container.appendChild(renderHeader(this.dark, this.toggleTheme));

    // Form / Import Row
    const formRow = document.createElement("div");
    formRow.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";

    const searchCol = document.createElement("div");
    const canRefresh =
      this.data !== null &&
      this.input.trim() === this.lastSubmitted.username &&
      this.apiKey.trim() === this.lastSubmitted.apiKey;

    searchCol.appendChild(
      renderSearchForm({
        value: this.input,
        apiKey: this.apiKey,
        onChange: this.handleInputChange,
        onApiKeyChange: this.handleApiKeyChange,
        onSubmit: this.handleSubmit,
        loading: this.loading,
        canRefresh,
      })
    );
    formRow.appendChild(searchCol);

    const actionCol = document.createElement("div");
    actionCol.className = "flex items-start";
    if (this.data) {
      const wrapper = document.createElement("div");
      wrapper.className = "flex flex-col gap-2 w-full";

      const clearBtn = document.createElement("button");
      clearBtn.className = "w-full py-3 text-sm font-medium border bg-beige-100 dark:bg-beige-900 border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 text-center cursor-pointer";
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", this.handleClear);
      wrapper.appendChild(clearBtn);

      if (this.dataSource === "api" || this.dataSource === "cache") {
        wrapper.appendChild(renderCsvExportButton(this.data, this.fullRaces));
      }
      actionCol.appendChild(wrapper);
    } else {
      actionCol.appendChild(renderDataImport({ onDataParsed: this.handleImport }));
    }
    formRow.appendChild(actionCol);
    container.appendChild(formRow);

    // Error Banner
    if (this.error) {
      container.appendChild(renderErrorBanner(this.error));
    }

    // Main Data Section
    if (this.data) {
      const derived = this.getDerivedData();

      // Profile
      const profileWrap = document.createElement("div");
      profileWrap.id = "user-profile-section";
      profileWrap.appendChild(renderUserProfile(this.data, this.dataSource));
      container.appendChild(profileWrap);

      // Stats Cards
      container.appendChild(renderStatsCards(this.data));

      if (this.data.races.length > 0 && derived) {
        // Controls Row: Metric & Race Limit buttons
        const controls = document.createElement("div");
        controls.className = "flex flex-wrap items-center justify-between gap-3";

        const btnGroup = document.createElement("div");
        btnGroup.className = "flex gap-2 flex-wrap";

        // Metrics
        (["speed", "accuracy", "points", "wins"] as Metric[]).forEach((m) => {
          const btn = document.createElement("button");
          btn.className = `px-3 py-1.5 text-sm font-medium capitalize border cursor-pointer ${
            this.selectedMetric === m
              ? "bg-red-900 text-beige-50 border-red-900"
              : "bg-beige-100 dark:bg-beige-900 border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100"
          }`;
          btn.textContent = m;
          btn.addEventListener("click", () => {
            this.selectedMetric = m;
            this.render();
          });
          btnGroup.appendChild(btn);
        });

        const divider = document.createElement("span");
        divider.className = "w-px bg-beige-300 dark:bg-beige-700 mx-1";
        btnGroup.appendChild(divider);

        // Race Limits
        raceLimitOptions.forEach((limit) => {
          const btn = document.createElement("button");
          btn.className = `px-2 py-1.5 text-xs font-medium border cursor-pointer ${
            this.raceLimit === limit
              ? "bg-red-900 text-beige-50 border-red-900"
              : "bg-beige-100 dark:bg-beige-900 border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100"
          }`;
          btn.textContent = `Last ${limit}`;
          btn.addEventListener("click", () => {
            this.raceLimit = this.raceLimit === limit ? null : limit;
            this.render();
          });
          btnGroup.appendChild(btn);
        });

        if (this.raceLimit) {
          const allBtn = document.createElement("button");
          allBtn.className = "px-2 py-1.5 text-xs font-medium bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 cursor-pointer";
          allBtn.textContent = "All";
          allBtn.addEventListener("click", () => {
            this.raceLimit = null;
            this.render();
          });
          btnGroup.appendChild(allBtn);
        }

        controls.appendChild(btnGroup);

        if (this.zoomBounds) {
          const resetBtn = document.createElement("button");
          resetBtn.className = "px-3 py-1.5 text-sm font-medium bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 cursor-pointer";
          resetBtn.textContent = "Reset Zoom";
          resetBtn.addEventListener("click", this.resetZoom);
          controls.appendChild(resetBtn);
        }

        container.appendChild(controls);

        // Timeframe Summary Stats
        container.appendChild(renderTimeframeStats(derived.timeframeStats));

        // Chart Container
        const chartExportBox = document.createElement("div");
        chartExportBox.id = "chart-export";
        chartExportBox.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4";

        const chartHeader = document.createElement("div");
        chartHeader.className = "flex items-center justify-between mb-3";

        const chartTitle = document.createElement("h3");
        chartTitle.className = "text-sm font-semibold text-beige-700 dark:text-beige-300 uppercase tracking-wide";
        chartTitle.textContent = `${this.selectedMetric.toUpperCase()} OVER TIME`;

        const chartRight = document.createElement("div");
        chartRight.className = "flex items-center gap-2";

        if (derived.regression) {
          const trendSpan = document.createElement("span");
          trendSpan.className = "text-xs font-mono text-beige-600 dark:text-beige-400";
          trendSpan.textContent = `Trend: ${derived.regression.slope > 0 ? "+" : ""}${derived.regression.slope.toFixed(4)} per race (${(derived.regression.slope * 100).toFixed(2)} per 100 races)`;
          chartRight.appendChild(trendSpan);
        }

        const themeStr = this.dark ? "dark" : "light";
        const limitStr = this.raceLimit ? `last-${this.raceLimit}` : "all";
        chartRight.appendChild(renderExportButton("chart-export", `chart_${themeStr}_${this.selectedMetric}_${limitStr}.png`));

        chartHeader.appendChild(chartTitle);
        chartHeader.appendChild(chartRight);
        chartExportBox.appendChild(chartHeader);

        const lineColor = this.selectedMetric === "speed" ? "#8884d8" : this.selectedMetric === "accuracy" ? "#82ca9d" : "#ffc658";
        const regressionColor = this.selectedMetric === "speed" ? "#ff6b6b" : "#f39c12";

        chartExportBox.appendChild(
          renderChart({
            data: derived.rollingData,
            selectedMetric: this.selectedMetric,
            lineColor,
            regressionColor,
            regression: derived.regression,
            onMouseDown: (ts) => { this.refAreaLeft = ts; },
            onMouseMove: (ts) => { if (this.refAreaLeft != null) this.refAreaRight = ts; },
            onMouseUp: () => {
              if (this.refAreaLeft != null && this.refAreaRight != null) {
                const left = Math.min(this.refAreaLeft, this.refAreaRight);
                const right = Math.max(this.refAreaLeft, this.refAreaRight);
                if (right - left > 60000) {
                  this.zoomBounds = { left, right };
                }
              }
              this.refAreaLeft = null;
              this.refAreaRight = null;
              this.render();
            },
            onResetZoom: this.resetZoom,
            refAreaLeft: derived.useDateLabels ? this.refAreaLeft : null,
            refAreaRight: derived.useDateLabels ? this.refAreaRight : null,
            formatDate: formatDisplayDate,
          })
        );

        const note = document.createElement("p");
        note.className = "no-export text-xs text-beige-600 dark:text-beige-400 mt-2 text-center";
        note.textContent = derived.useDateLabels
          ? "Drag on the chart to select a timeframe, or click to reset zoom. Averages update automatically."
          : "Races shown in sequential order.";
        chartExportBox.appendChild(note);

        container.appendChild(chartExportBox);

        // Activity Heatmap
        if (derived.useDateLabels) {
          const heatmapBox = document.createElement("div");
          heatmapBox.id = "heatmap-export";
          heatmapBox.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4";

          const hmHeader = document.createElement("div");
          hmHeader.className = "flex items-center justify-between mb-3";

          const hmTitle = document.createElement("h3");
          hmTitle.className = "text-sm font-semibold text-beige-700 dark:text-beige-300 uppercase tracking-wide";
          hmTitle.textContent = "DAILY ACTIVITY";

          hmHeader.appendChild(hmTitle);
          hmHeader.appendChild(renderExportButton("heatmap-export", `heatmap_${themeStr}.png`));
          heatmapBox.appendChild(hmHeader);

          heatmapBox.appendChild(renderActivityHeatmap({ races: this.data.races, dark: this.dark }));

          const legend = document.createElement("div");
          legend.className = "flex items-center justify-center gap-1 mt-2 text-[10px] text-beige-600 dark:text-beige-400";
          legend.innerHTML = `
            <span>Less</span>
            <div class="flex gap-[2px]">
              ${["bg-beige-100", "bg-red-100", "bg-red-200", "bg-red-400", "bg-red-600", "bg-red-800", "bg-red-900"]
                .map((c) => `<div class="w-3 h-3 ${c}"></div>`)
                .join("")}
            </div>
            <span>More</span>
            ${this.dark ? `<span class="ml-2 text-[10px] text-beige-400">(dark: red intensity)</span>` : ""}
          `;
          heatmapBox.appendChild(legend);

          container.appendChild(heatmapBox);
        }

        // Sortable Race History Table
        container.appendChild(renderRaceTable({ races: this.data.races }));
      }
    }

    // Loading Squares Loader
    if (this.loading) {
      const loader = document.createElement("div");
      loader.className = "flex justify-center py-20";
      loader.innerHTML = `
        <div class="flex gap-1.5">
          <div class="w-3 h-3 bg-red-900 dark:bg-red-400 animate-pulse-square"></div>
          <div class="w-3 h-3 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.15s"></div>
          <div class="w-3 h-3 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.3s"></div>
          <div class="w-3 h-3 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.45s"></div>
        </div>
      `;
      container.appendChild(loader);
    }

    this.rootEl.appendChild(container);
  }
}

new App();
