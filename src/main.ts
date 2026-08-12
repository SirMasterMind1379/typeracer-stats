import "./index.css";
import { renderHeader, type ThemeMode } from "./components/Header";
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
import { renderModeComparison, categorizeRaceMode } from "./components/ModeComparison";
import { renderTextCollector, type TextCollectorState } from "./components/TextCollector";
import type { UserData, Race, Metric, TimeframeStats } from "./types";
import { formatDisplayDate, sortByDate, getCookie } from "./types";
import { getCachedRaces, saveCachedRaces, getCachedProfile, saveCachedProfile } from "./db";

const WINDOW = 100;
const raceLimitOptions = [2000, 1500, 1000, 500, 200, 100, 50, 20];

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
  private selectedModeFilter: string = "all";
  private raceLimit: number | null = null;

  // Auto Theme: System/Browser preference by default for new users ("auto" | "light" | "dark")
  private themeMode: ThemeMode = "auto";
  private dark = false;

  private refAreaLeft: number | null = null;
  private refAreaRight: number | null = null;
  private zoomBounds: { left: number; right: number } | null = null;

  private lastSubmitted = { username: "", apiKey: "" };

  private textCollectorState: TextCollectorState = {
    isPokedexView: false,
    selectedQuoteId: null,
    filterSearch: "",
    currentSort: "recent",
    filterRepeat: "all",
    pageSize: 30,
  };

  private rootEl: HTMLElement;

  constructor() {
    this.rootEl = document.getElementById("app")!;
    this.input = getCookie("tr_username");
    this.apiKey = getCookie("tr_api_key");
    this.initTheme();
    this.render();
  }

  private initTheme() {
    const stored = localStorage.getItem("theme_mode") as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "auto") {
      this.themeMode = stored;
    } else {
      // Default for new users: "auto" (catches OS & browser dark/light preference!)
      this.themeMode = "auto";
    }

    this.applyTheme();

    // Dynamically update theme when OS / browser color scheme changes in auto mode
    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (this.themeMode === "auto") {
          this.applyTheme();
          this.render();
        }
      });
    }
  }

  private applyTheme() {
    if (this.themeMode === "auto") {
      this.dark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      this.dark = this.themeMode === "dark";
    }
    document.documentElement.classList.toggle("dark", this.dark);
  }

  private toggleTheme = () => {
    if (this.themeMode === "auto") this.themeMode = "light";
    else if (this.themeMode === "light") this.themeMode = "dark";
    else this.themeMode = "auto";

    localStorage.setItem("theme_mode", this.themeMode);
    this.applyTheme();
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

    this.data = null;
    this.fullRaces = [];
    this.dataSource = null;

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
      const timeout = setTimeout(() => controller.abort(), 45000);
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
      const filteredFresh = freshRaces.filter((r: Race) => r.speed != null && r.speed > 0);

      let mergedRaces = filteredFresh;
      if (key) {
        const raceMap = new Map<string, Race>();
        for (const r of cachedRaces) raceMap.set(r.id, r);
        for (const r of filteredFresh) raceMap.set(r.id, r);
        mergedRaces = Array.from(raceMap.values());
        result.races = mergedRaces;

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

    const filtered = races.filter((r) => r.speed != null && r.speed > 0);
    const sorted = sortByDate(filtered).map((r) => ({ ...r, date: r.date.replace(" ", "T") }));

    const total = sorted.length;
    const speeds = sorted.map((r) => r.speed);
    const avgWpm = speeds.reduce((s, v) => s + v, 0) / total || 0;
    const bestWpm = Math.max(...speeds) || 0;
    const totalPoints = sorted.reduce((s, r) => s + (r.points || 0), 0);
    const totalWins = sorted.filter((r) => r.won).length;

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

  private getFilteredRaces(): Race[] {
    if (!this.data) return [];
    if (this.selectedModeFilter === "all") return this.data.races;
    return this.data.races.filter((r) => categorizeRaceMode(r) === this.selectedModeFilter);
  }

  private prepareChartData() {
    const activeRaces = this.getFilteredRaces();
    if (!activeRaces.length) return null;

    const sortedRaces = sortByDate(activeRaces);
    const allChartData = sortedRaces.map((r, i) => ({
      ...r,
      index: i + 1,
      ts: new Date(r.date.replace(" ", "T")).getTime(),
    }));

    const useDateLabels = sortedRaces.length < 50;
    const zoomedData = !this.zoomBounds
      ? allChartData
      : allChartData.filter((d) => d.ts >= this.zoomBounds!.left && d.ts <= this.zoomBounds!.right);

    const filteredData = this.raceLimit ? zoomedData.slice(-this.raceLimit) : zoomedData;

    const rollingData: any[] = [];
    let cp = 0;
    for (let i = 0; i < filteredData.length; i++) {
      const d = filteredData[i];
      const slice = filteredData.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const wins = slice.filter((r) => r.won).length;
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

    const timeframeStats: TimeframeStats | null = filteredData.length
      ? {
          races: filteredData.length,
          avgSpeed: (filteredData.reduce((s, r) => s + r.speed, 0) / filteredData.length).toFixed(1),
          avgAcc: (filteredData.reduce((s, r) => s + r.accuracy, 0) / filteredData.length).toFixed(1),
          wins: filteredData.filter((r) => r.won).length,
          totalPoints: filteredData.reduce((s, r) => s + (r.points || 0), 0).toFixed(0),
          winRate: ((filteredData.filter((r) => r.won).length / filteredData.length) * 100).toFixed(1),
        }
      : null;

    return { useDateLabels, rollingData, regression, timeframeStats };
  }

  private render() {
    this.rootEl.innerHTML = "";

    const container = document.createElement("div");
    container.className = "max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6 font-sans min-h-screen bg-beige-50 dark:bg-beige-950 text-beige-900 dark:text-beige-100 transition-colors duration-200";

    container.appendChild(renderHeader(this.themeMode, this.dark, this.toggleTheme));

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

    if (this.error) {
      container.appendChild(renderErrorBanner(this.error));
    }

    if (this.data) {
      const derived = this.prepareChartData();

      const profileWrap = document.createElement("div");
      profileWrap.id = "user-profile-section";
      profileWrap.appendChild(renderUserProfile(this.data, this.dataSource));
      container.appendChild(profileWrap);

      container.appendChild(renderStatsCards(this.data));

      if (this.data.races.length > 0 && derived) {
        const controls = document.createElement("div");
        controls.className = "flex flex-wrap items-center justify-between gap-3 w-full";

        const btnGroup = document.createElement("div");
        btnGroup.className = "flex flex-wrap items-center gap-3 w-full xl:w-auto";

        const getBtnCls = (active: boolean) =>
          `h-8.5 px-2.5 text-xs font-medium border cursor-pointer inline-flex items-center justify-center whitespace-nowrap transition-colors ${
            active
              ? "bg-red-900 text-beige-50 border-red-900 font-bold"
              : "bg-beige-100 dark:bg-beige-900 border-beige-300 dark:border-beige-700 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100"
          }`;

        const modeGroup = document.createElement("div");
        modeGroup.className = "flex flex-wrap items-center gap-1.5";

        const modeOpts: { key: string; label: string }[] = [
          { key: "all", label: "All Modes" },
          { key: "multiplayer", label: "Multiplayer" },
          { key: "practice_qotd", label: "Practice / QOTD" },
          { key: "room", label: "Custom Rooms" },
        ];
        modeOpts.forEach((opt) => {
          const btn = document.createElement("button");
          btn.className = getBtnCls(this.selectedModeFilter === opt.key);
          btn.textContent = opt.label;
          btn.addEventListener("click", () => {
            this.selectedModeFilter = opt.key;
            this.render();
          });
          modeGroup.appendChild(btn);
        });
        btnGroup.appendChild(modeGroup);

        const sep1 = document.createElement("div");
        sep1.className = "hidden xl:block w-px h-6 bg-beige-300 dark:bg-beige-700 mx-0.5 shrink-0 self-center";
        btnGroup.appendChild(sep1);

        const statGroup = document.createElement("div");
        statGroup.className = "flex flex-wrap items-center gap-1.5";

        (["speed", "accuracy", "points", "wins"] as Metric[]).forEach((m) => {
          const btn = document.createElement("button");
          btn.className = getBtnCls(this.selectedMetric === m);
          btn.textContent = m.charAt(0).toUpperCase() + m.slice(1);
          btn.addEventListener("click", () => {
            this.selectedMetric = m;
            this.render();
          });
          statGroup.appendChild(btn);
        });
        btnGroup.appendChild(statGroup);

        const sep2 = document.createElement("div");
        sep2.className = "hidden xl:block w-px h-6 bg-beige-300 dark:bg-beige-700 mx-0.5 shrink-0 self-center";
        btnGroup.appendChild(sep2);

        const limitGroup = document.createElement("div");
        limitGroup.className = "flex flex-wrap items-center gap-1.5";

        const allBtn = document.createElement("button");
        allBtn.className = getBtnCls(this.raceLimit === null);
        allBtn.textContent = "All Races";
        allBtn.addEventListener("click", () => {
          this.raceLimit = null;
          this.render();
        });
        limitGroup.appendChild(allBtn);

        raceLimitOptions.forEach((limit) => {
          const btn = document.createElement("button");
          btn.className = getBtnCls(this.raceLimit === limit);
          btn.textContent = `Last ${limit}`;
          btn.addEventListener("click", () => {
            this.raceLimit = this.raceLimit === limit ? null : limit;
            this.render();
          });
          limitGroup.appendChild(btn);
        });

        btnGroup.appendChild(limitGroup);

        controls.appendChild(btnGroup);

        if (this.zoomBounds) {
          const resetBtn = document.createElement("button");
          resetBtn.className = getBtnCls(false);
          resetBtn.textContent = "Reset Zoom";
          resetBtn.addEventListener("click", this.resetZoom);
          controls.appendChild(resetBtn);
        }

        container.appendChild(controls);

        if (derived.timeframeStats) {
          container.appendChild(renderTimeframeStats(derived.timeframeStats));
        }

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

        heatmapBox.appendChild(renderActivityHeatmap({ races: this.getFilteredRaces(), dark: this.dark }));

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

        container.appendChild(renderRaceTable({ races: this.getFilteredRaces(), username: this.data.username }));

        container.appendChild(
          renderModeComparison(this.data.races, (modeKey) => {
            this.selectedModeFilter = modeKey;
            this.render();
          })
        );

        container.appendChild(renderTextCollector(this.getFilteredRaces(), this.textCollectorState));
      }
    } else if (this.loading) {
      container.appendChild(this.renderDashboardSkeleton());
    }

    this.rootEl.appendChild(container);
  }

  private renderDashboardSkeleton(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-6 w-full font-mono mt-2";

    // 1. Loading Status Banner
    const statusBox = document.createElement("div");
    statusBox.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col items-center justify-center gap-2.5 text-center";
    statusBox.innerHTML = `
      <div class="flex gap-1.5">
        <div class="w-3.5 h-3.5 bg-red-900 dark:bg-red-400 animate-pulse-square"></div>
        <div class="w-3.5 h-3.5 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.15s"></div>
        <div class="w-3.5 h-3.5 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.3s"></div>
        <div class="w-3.5 h-3.5 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.45s"></div>
      </div>
      <span class="text-xs font-bold text-red-900 dark:text-red-400 uppercase tracking-widest animate-pulse">
        Fetching Profile Stats & Lifetime Race History... Please wait
      </span>
      <span class="text-[10px] text-beige-600 dark:text-beige-400">Loading historical dates & multi-batch race data</span>
    `;
    wrapper.appendChild(statusBox);

    // 2. User Profile Box Skeleton (exact location)
    const profileSkeleton = document.createElement("div");
    profileSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse";
    profileSkeleton.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 bg-beige-300 dark:bg-beige-800 rounded-full"></div>
        <div class="flex flex-col gap-2">
          <div class="h-5 w-44 bg-beige-300 dark:bg-beige-800"></div>
          <div class="h-3.5 w-28 bg-beige-300 dark:bg-beige-800"></div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="h-8 w-28 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-8 w-28 bg-beige-300 dark:bg-beige-800"></div>
      </div>
    `;
    wrapper.appendChild(profileSkeleton);

    // 3. Stats Summary Cards Row Skeleton (4 Grid items in exact location)
    const statsSkeleton = document.createElement("div");
    statsSkeleton.className = "grid grid-cols-2 md:grid-cols-4 gap-3";
    for (let i = 0; i < 4; i++) {
      const card = document.createElement("div");
      card.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 flex flex-col gap-2.5 animate-pulse";
      card.style.animationDelay = `${i * 0.08}s`;
      card.innerHTML = `
        <div class="h-3 w-16 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-7 w-24 bg-beige-300 dark:bg-beige-800"></div>
      `;
      statsSkeleton.appendChild(card);
    }
    wrapper.appendChild(statsSkeleton);

    // 4. Chart Controls Bar Skeleton (exact location)
    const controlsSkeleton = document.createElement("div");
    controlsSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-3 flex flex-wrap justify-between items-center gap-3 animate-pulse";
    controlsSkeleton.innerHTML = `
      <div class="flex gap-2">
        <div class="h-8 w-20 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-8 w-24 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-8 w-20 bg-beige-300 dark:bg-beige-800"></div>
      </div>
      <div class="h-8 w-32 bg-beige-300 dark:bg-beige-800"></div>
    `;
    wrapper.appendChild(controlsSkeleton);

    // 5. Timeframe Stats Summary Skeleton
    const timeframeSkeleton = document.createElement("div");
    timeframeSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse";
    for (let i = 0; i < 4; i++) {
      const item = document.createElement("div");
      item.className = "flex flex-col gap-1.5";
      item.innerHTML = `
        <div class="h-3 w-16 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-6 w-20 bg-beige-300 dark:bg-beige-800"></div>
      `;
      timeframeSkeleton.appendChild(item);
    }
    wrapper.appendChild(timeframeSkeleton);

    // 6. Speed Over Time Chart Container Skeleton (exact location)
    const chartSkeleton = document.createElement("div");
    chartSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col gap-4 animate-pulse";
    chartSkeleton.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="h-4 w-40 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-4 w-28 bg-beige-300 dark:bg-beige-800"></div>
      </div>
      <div class="h-72 bg-beige-200/50 dark:bg-beige-800/40 border border-dashed border-beige-300 dark:border-beige-700 flex flex-col items-center justify-center gap-2">
        <span class="text-xs font-bold text-beige-600 dark:text-beige-400">Loading Speed Over Time Chart...</span>
      </div>
    `;
    wrapper.appendChild(chartSkeleton);

    // 7. Daily Activity Heatmap Box Skeleton (exact location)
    const heatmapSkeleton = document.createElement("div");
    heatmapSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col gap-4 animate-pulse";
    heatmapSkeleton.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="h-4 w-32 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-4 w-20 bg-beige-300 dark:bg-beige-800"></div>
      </div>
      <div class="h-28 bg-beige-200/50 dark:bg-beige-800/40 border border-dashed border-beige-300 dark:border-beige-700 flex items-center justify-center">
        <span class="text-xs text-beige-600 dark:text-beige-400">Generating 52-Week Activity Heatmap...</span>
      </div>
    `;
    wrapper.appendChild(heatmapSkeleton);

    // 8. Race History Table Box Skeleton (exact location)
    const tableSkeleton = document.createElement("div");
    tableSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col gap-3 animate-pulse";
    tableSkeleton.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="h-4 w-44 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-8 w-32 bg-beige-300 dark:bg-beige-800"></div>
      </div>
      <div class="flex flex-col gap-2">
        ${Array(5)
          .fill(0)
          .map(
            () => `
          <div class="h-9 bg-beige-200/60 dark:bg-beige-800/60 border border-beige-300/40 dark:border-beige-700/40"></div>
        `
          )
          .join("")}
      </div>
    `;
    wrapper.appendChild(tableSkeleton);

    // 9. Per-Mode Performance Breakdown Skeleton (exact location)
    const modeSkeleton = document.createElement("div");
    modeSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col gap-4 animate-pulse";
    modeSkeleton.innerHTML = `
      <div class="h-4 w-56 bg-beige-300 dark:bg-beige-800"></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="h-32 bg-beige-200/60 dark:bg-beige-800/60 border border-beige-300 dark:border-beige-700"></div>
        <div class="h-32 bg-beige-200/60 dark:bg-beige-800/60 border border-beige-300 dark:border-beige-700"></div>
        <div class="h-32 bg-beige-200/60 dark:bg-beige-800/60 border border-beige-300 dark:border-beige-700"></div>
      </div>
    `;
    wrapper.appendChild(modeSkeleton);

    // 10. Text Collector Pokédex Skeleton (exact location)
    const textCollectorSkeleton = document.createElement("div");
    textCollectorSkeleton.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-5 flex flex-col gap-4 animate-pulse";
    textCollectorSkeleton.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="h-4 w-44 bg-beige-300 dark:bg-beige-800"></div>
        <div class="h-8 w-36 bg-beige-300 dark:bg-beige-800"></div>
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2 mt-1">
        ${Array(18)
          .fill(0)
          .map(
            () => `
          <div class="h-12 bg-beige-200/60 dark:bg-beige-800/60 border border-beige-300/40 dark:border-beige-700/40"></div>
        `
          )
          .join("")}
      </div>
    `;
    wrapper.appendChild(textCollectorSkeleton);

    return wrapper;
  }
}

new App();
