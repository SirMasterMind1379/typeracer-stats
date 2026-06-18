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
import type { UserData, Metric, TimeframeStats as TStats } from "./components/types";

/** Format an ISO date string to a short display label. */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Convert an ISO date string to a numeric timestamp. */
function toDate(dateStr: string) {
  return new Date(dateStr).getTime();
}

export default function Home() {
  /* ── form state ──────────────────────────────────────────── */
  const [input, setInput] = useState("");
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── display state ───────────────────────────────────────── */
  const [selectedMetric, setSelectedMetric] = useState<Metric>("speed");
  const [raceLimit, setRaceLimit] = useState<number | null>(null);
  const [dark, setDark] = useState(false);

  /* ── zoom state ──────────────────────────────────────────── */
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const chartRef = useRef<{ left: number; right: number } | null>(null);

  /* ── theme initialisation ────────────────────────────────── */
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  /* ── form submission ─────────────────────────────────────── */
  const handleSubmit = useCallback(
    async (apiKey: string) => {
      setLoading(true);
      setError("");
      setData(null);
      setRefAreaLeft(null);
      setRefAreaRight(null);
      chartRef.current = null;

      let username = input.trim();
      const match = username.match(/typeracer\.com\/pit\/racer\?user=(\w+)/);
      if (match) username = match[1];

      if (!username) {
        setError("Please enter a username or profile link");
        setLoading(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const body: Record<string, string> = { username };
        if (apiKey.trim()) {
          body.apiKey = apiKey.trim();
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
          return;
        }
        setData(result);
      } catch (err: any) {
        if (err.name === "AbortError") {
          setError("Request timed out. Server may be restarting.");
        } else {
          setError(
            `Network error: ${err.message}. Make sure the server is running on port 1384.`
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [input],
  );

  /* ── zoom handlers ───────────────────────────────────────── */
  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(toDate(e.activeLabel));
  }, []);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (!refAreaLeft || !e?.activeLabel) return;
      setRefAreaRight(toDate(e.activeLabel));
    },
    [refAreaLeft],
  );

  const handleMouseUp = useCallback(() => {
    if (!refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const left = Math.min(refAreaLeft, refAreaRight);
    const right = Math.max(refAreaLeft, refAreaRight);
    if (right - left > 60000) {
      chartRef.current = { left, right };
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight]);

  const handleZoomOut = useCallback(() => {
    chartRef.current = null;
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, []);

  /* ── derived data ────────────────────────────────────────── */
  const allChartData = useMemo(() => {
    if (!data?.races.length) return [];
    return [...data.races]
      .sort((a, b) => toDate(a.date) - toDate(b.date))
      .map((r) => ({ ...r, dateLabel: formatDate(r.date), ts: toDate(r.date) }));
  }, [data]);

  const zoomedData = useMemo(() => {
    if (!chartRef.current) return allChartData;
    const { left, right } = chartRef.current;
    return allChartData.filter((d) => d.ts >= left && d.ts <= right);
  }, [allChartData]);

  const filteredData = useMemo(() => {
    if (!raceLimit) return zoomedData;
    return zoomedData.slice(-raceLimit);
  }, [zoomedData, raceLimit]);

  const rollingData = useMemo(() => {
    const WINDOW = 10;
    let cumPoints = 0;
    return filteredData.map((d, i) => {
      const slice = filteredData.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const wins = slice.filter((r) => r.won).length;
      cumPoints += d.points || 0;
      return {
        ...d,
        speed: d.speed,
        accuracy: d.accuracy,
        winsPer10: +wins.toFixed(1),
        cumulativePoints: cumPoints,
      };
    });
  }, [filteredData]);

  const regression = useMemo(() => {
    if (rollingData.length < 5) return null;
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

  const timeframeStats: TStats | null = useMemo(() => {
    if (!filteredData.length) return null;
    const n = filteredData.length;
    const avgSpeed = filteredData.reduce((s, r) => s + r.speed, 0) / n;
    const avgAcc = filteredData.reduce((s, r) => s + r.accuracy, 0) / n;
    const wins = filteredData.filter((r) => r.won).length;
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
  const regressionColor = selectedMetric === "speed" ? "#4c3fa8" : "#3a8a5a";

  const raceLimitOptions = [1000, 500, 200, 100, 50, 20];
  const maxRaces = data?.races.length ?? 0;

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen transition-colors">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
        <Header dark={dark} onToggle={toggleTheme} />

        <SearchForm
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            <UserProfile data={data} />
            <StatsCards data={data} />

            {data.races.length > 0 && (
              <>
                {/* Metric + race-limit selector */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {(["speed", "accuracy", "points"] as Metric[]).map((m) => (
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
                  {chartRef.current && (
                    <button
                      onClick={handleZoomOut}
                      className="px-3 py-1.5 text-sm font-medium bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 hover:bg-beige-200 dark:hover:bg-zinc-800"
                    >
                      Reset Zoom
                    </button>
                  )}
                </div>

                <TimeframeStats stats={timeframeStats} />

                {/* Chart */}
                <div className="bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-beige-700 dark:text-zinc-400 uppercase tracking-wide">
                      {selectedMetric === "speed"
                        ? "Speed"
                        : selectedMetric === "accuracy"
                        ? "Accuracy"
                        : "Points"}{" "}
                      Over Time
                    </h3>
                    {regression && (
                      <span className="text-xs font-mono text-beige-600 dark:text-zinc-500">
                        Trend: {regression.slope > 0 ? "+" : ""}
                        {regression.slope.toFixed(4)} per race (
                        {(regression.slope * 100).toFixed(2)} per 100 races)
                      </span>
                    )}
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
                    refAreaLeft={refAreaLeft}
                    refAreaRight={refAreaRight}
                    formatDate={formatDate}
                  />
                  <p className="text-xs text-beige-600 dark:text-zinc-500 mt-2 text-center">
                    Drag on the chart to select a timeframe. Averages update automatically.
                  </p>
                </div>

                {/* Heatmap */}
                <div className="bg-beige-50 dark:bg-zinc-900 border border-beige-300 dark:border-zinc-700 p-4">
                  <h3 className="text-sm font-semibold mb-3 text-beige-700 dark:text-zinc-400 uppercase tracking-wide">
                    Daily Activity
                  </h3>
                  <ActivityHeatmap races={data.races} dark={dark} />
                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-beige-600 dark:text-zinc-500">
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
