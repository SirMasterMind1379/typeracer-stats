"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import UserProfile from "./components/UserProfile";
import StatsCards from "./components/StatsCards";
import TimeframeStats from "./components/TimeframeStats";
import Chart from "./components/Chart";
import ActivityHeatmap from "./components/ActivityHeatmap";
import ErrorBanner from "./components/ErrorBanner";
import DataImport from "./components/DataImport";
import ExportButton from "./components/ExportButton";
import CsvExportButton from "./components/CsvExportButton";
import type { UserData, Race, Metric, TimeframeStats as TStats } from "./components/types";
import { formatDisplayDate, isCompetitiveRace, sortByDate } from "./components/types";

const WINDOW = 100;
const raceLimitOptions = [1000, 500, 200, 100, 50, 20];

function hasValidDates(races: Race[]): boolean {
  return races.length > 0 && races.some((r) => {
    const d = new Date(r.date);
    return !isNaN(d.getTime()) && d.getTime() > 0;
  });
}

function niceAxisConfig(min: number, max: number, cap?: number) {
  const range = max - min;
  let step: number;
  if (range <= 5) step = 1;
  else if (range <= 10) step = 2;
  else if (range <= 20) step = 5;
  else step = 10;
  const bottom = Math.floor(min / step) * step;
  const rawTop = Math.ceil(max / step) * step;
  const top = cap !== undefined ? Math.min(rawTop, cap) : rawTop;
  return { min: bottom, max: top };
}

export default function Home() {
  /* ── form state ──────────────────────────────────────────── */
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [data, setData] = useState<UserData | null>(null);
  const [dataSource, setDataSource] = useState<"api" | "import" | null>(null);
  const [fullRaces, setFullRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── display state ───────────────────────────────────────── */
  const [selectedMetric, setSelectedMetric] = useState<Metric>("speed");
  const [raceLimit, setRaceLimit] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const themeInited = useRef(false);

  /* ── zoom state ──────────────────────────────────────────── */
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [zoomBounds, setZoomBounds] = useState<{ left: number; right: number } | null>(null);

  /* ── scroll ref ──────────────────────────────────────────── */
  const profileRef = useRef<HTMLDivElement>(null);

  /* ── track last submitted values for refresh button ─────── */
  const lastSubmitted = useRef({ username: "", apiKey: "" });
  const canRefresh = data !== null && input.trim() === lastSubmitted.current.username && apiKey.trim() === lastSubmitted.current.apiKey;

  /* ── theme side-effect ───────────────────────────────────── */
  useEffect(() => {
    if (!themeInited.current) {
      themeInited.current = true;
      const stored = localStorage.getItem("theme");
      const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDark(isDark);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  /* ── auto-scroll ─────────────────────────────────────────── */
  useEffect(() => {
    if (data && !loading) {
      setTimeout(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [data, loading]);

  /* ── input change handler (detects API key in username field) ─ */
  const handleInputChange = useCallback((v: string) => {
    if (/^[a-zA-Z0-9]{32}$/.test(v.trim())) {
      setApiKey(v.trim());
      setInput("");
    } else {
      setInput(v);
    }
  }, []);

  /* ── form submission ─────────────────────────────────────── */
  const handleSubmit = useCallback(
    async () => {
      setLoading(true);
      setError("");
      setRefAreaLeft(null);
      setRefAreaRight(null);
      setZoomBounds(null);

      let username = input.trim();
      const match = username.match(/typeracer\.com\/pit\/(?:profile|racer)\?user=(\w+)/);
      if (match) username = match[1];

      const key = apiKey.trim();

      if (!username) {
        setError("Please enter a username or profile link");
        setLoading(false);
        return;
      }

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
          setError(result.error || `Server error (${res.status})`);
          setLoading(false);
          return;
        }

        const allRaces = result.races || [];
        const filtered = allRaces.filter((r: Race) => isCompetitiveRace(r));
        result.races = filtered;
        setData(result);
        setFullRaces(allRaces);
        setDataSource(result.note ? null : "api");
        lastSubmitted.current = { username: input.trim(), apiKey: apiKey.trim() };
        if (result.username && result.username !== input.trim()) {
          setInput(result.username);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          setError("Request timed out. Server may be restarting.");
        } else {
          setError(`Network error: ${err.message}. Make sure the server is running on port 1384.`);
        }
      } finally {
        setLoading(false);
      }
    },
    [input, apiKey],
  );

  /* ── import handler ──────────────────────────────────────── */
  const handleImport = useCallback((races: Race[], username: string) => {
    if (dataSource === "api") {
      setError("API data has priority. Clear the search to use import data.");
      return;
    }
    setError("");
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setZoomBounds(null);
    setInput(username);

    const filtered = races.filter((r) => isCompetitiveRace(r));
    const sorted = sortByDate(filtered).map((r) => ({ ...r, date: r.date.replace(" ", "T") }));

    const total = sorted.length;
    const speeds = sorted.map((r) => r.speed);
    const avgWpm = speeds.reduce((s, v) => s + v, 0) / total || 0;
    const bestWpm = Math.max(...speeds) || 0;
    const totalPoints = sorted.reduce((s, r) => s + (r.points || 0), 0);
    const totalWins = sorted.filter((r) => r.won && isCompetitiveRace(r)).length;

    const allRaces = sortByDate(races).map((r) => ({ ...r, date: r.date.replace(" ", "T") }));

    setData({
      username,
      name: username,
      joinedAt: null,
      premium: false,
      stats: { totalRaces: total, totalWins, points: totalPoints, avgWpm, bestWpm, typistLevel: null },
      races: sorted,
      qotdDone: false,
      note: "Imported from race export",
    });
    setFullRaces(allRaces);
    setDataSource("import");
  }, [dataSource]);

  /* ── clear handler ───────────────────────────────────────── */
  const handleClear = useCallback(() => {
    setData(null);
    setDataSource(null);
    setFullRaces([]);
    setInput("");
    setApiKey("");
    setError("");
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setZoomBounds(null);
  }, []);

  /* ── ref to keep chart data accessible from zoom callbacks ── */
  const chartDataRef = useRef<any[]>([]);

  /* ── zoom handlers ───────────────────────────────────────── */
  const handleMouseDown = useCallback((_nextState: any) => {
    const idx = _nextState?.activeIndex;
    if (idx == null) return;
    const pt = chartDataRef.current[idx];
    if (!pt) return;
    setRefAreaLeft(pt.ts);
  }, []);

  const handleMouseMove = useCallback(
    (_nextState: any) => {
      if (refAreaLeft == null) return;
      const idx = _nextState?.activeIndex;
      if (idx == null) return;
      const pt = chartDataRef.current[idx];
      if (!pt) return;
      setRefAreaRight(pt.ts);
    },
    [refAreaLeft],
  );

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft == null || refAreaRight == null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const left = Math.min(refAreaLeft, refAreaRight);
    const right = Math.max(refAreaLeft, refAreaRight);
    if (right - left > 60000) {
      setZoomBounds({ left, right });
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight]);

  const handleZoomOut = useCallback(() => {
    setZoomBounds(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, []);

  /* ── derived data ────────────────────────────────────────── */
  const useDateLabels = hasValidDates(data?.races || []);

  const allChartData = useMemo(() => {
    if (!data?.races.length) return [];
    return sortByDate(data.races).map((r, i) => ({
      ...r,
      dateLabel: useDateLabels ? formatDisplayDate(r.date) : `Race ${i + 1}`,
      ts: useDateLabels ? new Date(r.date).getTime() : i,
    }));
  }, [data, useDateLabels]);

  const zoomedData = useMemo(() => {
    if (!zoomBounds || !useDateLabels) return allChartData;
    const { left, right } = zoomBounds;
    return allChartData.filter((d) => d.ts >= left && d.ts <= right);
  }, [allChartData, useDateLabels, zoomBounds]);

  const filteredData = useMemo(() => {
    if (!raceLimit) return zoomedData;
    return zoomedData.slice(-raceLimit);
  }, [zoomedData, raceLimit]);

  const rollingData = useMemo(() => {
    const result: any[] = [];
    let cp = 0;
    for (let i = 0; i < filteredData.length; i++) {
      const d = filteredData[i];
      const slice = filteredData.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const wins = slice.filter((r) => r.won && isCompetitiveRace(r)).length;
      cp += d.points || 0;
      result.push({ ...d, speed: d.speed, accuracy: d.accuracy, winsPer100: +wins.toFixed(1), cumulativePoints: cp });
    }
    return result;
  }, [filteredData]);

  const regression = useMemo(() => {
    if (rollingData.length < 5 || selectedMetric === "wins") return null;
    const key = selectedMetric === "speed" ? "speed" : "accuracy";
    const values = rollingData.map((d) => d[key]);
    const n = values.length;
    const indices = values.map((_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((s, i) => s + i * values[i], 0);
    const sumX2 = indices.reduce((s, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return {
      slope,
      intercept,
      line: values.map((_, i) => +(intercept + slope * i).toFixed(1)),
    };
  }, [rollingData, selectedMetric]);

  const chartDataWithRegression = useMemo(() => {
    if (!regression) return rollingData;
    return rollingData.map((d, i) => ({ ...d, regressionLine: regression.line[i] }));
  }, [rollingData, regression]);

  useEffect(() => {
    chartDataRef.current = chartDataWithRegression;
  }, [chartDataWithRegression]);

  const yAxisDomain = useMemo(() => {
    if (!chartDataWithRegression.length) return null;
    const speeds = chartDataWithRegression.map((d) => d.speed);
    const accs = chartDataWithRegression.map((d) => d.accuracy);
    const pts = chartDataWithRegression.map((d) => d.cumulativePoints);
    const wns = chartDataWithRegression.map((d) => d.winsPer100);
    return {
      speed: niceAxisConfig(Math.min(...speeds), Math.max(...speeds)),
      accuracy: niceAxisConfig(Math.min(...accs), Math.max(...accs), 100),
      points: niceAxisConfig(Math.min(...pts), Math.max(...pts)),
      wins: niceAxisConfig(Math.min(...wns), Math.max(...wns)),
    };
  }, [chartDataWithRegression]);

  const timeframeStats: TStats | null = useMemo(() => {
    if (!filteredData.length) return null;
    const n = filteredData.length;
    const avgSpeed = filteredData.reduce((s, r) => s + r.speed, 0) / n;
    const avgAcc = filteredData.reduce((s, r) => s + r.accuracy, 0) / n;
    const wins = filteredData.filter((r) => r.won && isCompetitiveRace(r)).length;
    const totalPoints = filteredData.reduce((s, r) => s + (r.points || 0), 0);
    return {
      races: n,
      avgSpeed: avgSpeed.toFixed(1),
      avgAcc: avgAcc.toFixed(1),
      wins,
      totalPoints: totalPoints.toFixed(0),
      winRate: ((wins / n) * 100).toFixed(1),
    };
  }, [filteredData]);

  const lineColor =
    selectedMetric === "speed"
      ? "#8884d8"
      : selectedMetric === "accuracy"
      ? "#82ca9d"
      : "#ffc658";
  const regressionColor = selectedMetric === "speed" ? "#ff6b6b" : "#f39c12";

  const maxRaces = data?.races.length ?? 0;
  const themeStr = dark ? "dark" : "light";
  const limitStr = raceLimit ? `last-${raceLimit}` : "all";
  const chartFilename = `chart_${themeStr}_${selectedMetric}_${limitStr}.png`;

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen transition-colors">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
        <Header dark={dark} onToggle={toggleTheme} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SearchForm
              value={input}
              apiKey={apiKey}
              onChange={handleInputChange}
              onApiKeyChange={setApiKey}
              onSubmit={handleSubmit}
              loading={loading}
              canRefresh={canRefresh}
            />
          </div>
          <div className="flex items-start">
            {data ? (
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handleClear}
                  className="w-full py-3 text-sm font-medium border bg-beige-50 dark:bg-zinc-900 border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800 text-center"
                >
                  Clear
                </button>
                {dataSource === "api" && <CsvExportButton data={data} allRaces={fullRaces} />}
              </div>
            ) : (
              <DataImport onDataParsed={handleImport} />
            )}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            <div ref={profileRef}>
              <UserProfile data={data} dataSource={dataSource} />
            </div>
            <StatsCards data={data} />

            {data.races.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {(["speed", "accuracy", "points", "wins"] as Metric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedMetric(m)}
                        className={`px-3 py-1.5 text-sm font-medium capitalize border ${
                          selectedMetric === m
                            ? "bg-red-900 text-beige-50 border-red-900"
                            : "bg-beige-50 dark:bg-zinc-900 border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    <span className="w-px bg-beige-300 dark:bg-zinc-700 mx-1" />
                    {raceLimitOptions.map((limit) => (
                      <button
                        key={limit}
                        onClick={() => setRaceLimit(raceLimit === limit ? null : limit)}
                        className={`px-2 py-1.5 text-xs font-medium border ${
                          raceLimit === limit
                            ? "bg-red-900 text-beige-50 border-red-900"
                            : "bg-beige-50 dark:bg-zinc-900 border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {maxRaces > limit ? `Last ${limit}` : limit}
                      </button>
                    ))}
                    {raceLimit && (
                      <button
                        onClick={() => setRaceLimit(null)}
                        className="px-2 py-1.5 text-xs font-medium bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800"
                      >
                        All
                      </button>
                    )}
                  </div>
                  {zoomBounds && (
                    <button
                      onClick={handleZoomOut}
                      className="px-3 py-1.5 text-sm font-medium bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800"
                    >
                      Reset Zoom
                    </button>
                  )}
                </div>

                <TimeframeStats stats={timeframeStats} />

                <div id="chart-export" className="bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-beige-700 dark:text-zinc-400 uppercase tracking-wide">
                      {selectedMetric === "speed"
                        ? "Speed"
                        : selectedMetric === "accuracy"
                        ? "Accuracy"
                        : selectedMetric === "points"
                        ? "Points"
                        : "Wins"}{" "}
                      Over Time
                    </h3>
                    <div className="flex items-center gap-2">
                      {regression && (
                        <span className="text-xs font-mono text-beige-600 dark:text-zinc-500">
                          Trend: {regression.slope > 0 ? "+" : ""}
                          {regression.slope.toFixed(4)} per race (
                          {(regression.slope * 100).toFixed(2)} per 100 races)
                        </span>
                      )}
                      <ExportButton targetId="chart-export" filename={chartFilename} />
                    </div>
                  </div>
                  <Chart
                    data={chartDataWithRegression}
                    selectedMetric={selectedMetric}
                    lineColor={lineColor}
                    regressionColor={regressionColor}
                    regression={regression}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    refAreaLeft={useDateLabels ? refAreaLeft : null}
                    refAreaRight={useDateLabels ? refAreaRight : null}
                    formatDate={formatDisplayDate}
                    yDomain={yAxisDomain?.[selectedMetric]}
                  />
                  <p className="no-export text-xs text-beige-600 dark:text-zinc-500 mt-2 text-center">
                    {useDateLabels
                      ? "Drag on the chart to select a timeframe. Averages update automatically."
                      : "Races shown in sequential order."}
                  </p>
                </div>

                {useDateLabels && (
                  <div id="heatmap-export" className="bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-beige-700 dark:text-zinc-400 uppercase tracking-wide">
                        Daily Activity
                      </h3>
                      <ExportButton targetId="heatmap-export" filename={`heatmap_${themeStr}.png`} />
                    </div>
                    <ActivityHeatmap races={data.races} dark={dark} />
                    <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-beige-600 dark:text-zinc-500">
                      <span>Less</span>
                      <div className="flex gap-[2px]">
                        {["bg-beige-100", "bg-red-100", "bg-red-200", "bg-red-400", "bg-red-600", "bg-red-800", "bg-red-900"].map(
                          (c) => (
                            <div key={c} className={`w-3 h-3 ${c}`} />
                          ),
                        )}
                      </div>
                      <span>More</span>
                      {dark && (
                        <span className="ml-2 text-[10px] text-zinc-500">
                          (dark: red intensity)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 bg-red-900 dark:bg-red-400 animate-pulse-square"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
