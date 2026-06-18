"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from "recharts";
import { Sun, Moon, Key, Eye, EyeOff, Check } from "lucide-react";

interface Race {
  id: string;
  date: string;
  speed: number;
  accuracy: number;
  points: number | null;
  rank: number;
  totalRacers: number;
  textId: number;
  won: boolean;
}

interface Stats {
  totalRaces: number;
  totalWins: number;
  points: number | null;
  avgWpm: number | null;
  bestWpm: number | null;
  certWpm: number | null;
}

interface UserData {
  username: string;
  name: string;
  joinedAt: string | null;
  premium: boolean;
  stats: Stats | null;
  races: Race[];
  qotdDone: boolean;
  note?: string;
}

type Metric = "speed" | "accuracy" | "points";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toDate(dateStr: string) {
  return new Date(dateStr).getTime();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          {entry.dataKey?.includes("acc") ? "%" : entry.dataKey?.includes("speed") ? " wpm" : ""}
        </p>
      ))}
    </div>
  );
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="w-full p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
      {message}
    </div>
  );
}

function ActivityHeatmap({ races, dark }: { races: Race[]; dark: boolean }) {
  const byDate = useMemo(() => {
    const map = new Map<string, { points: number; count: number }>();
    for (const r of races) {
      const key = r.date.slice(0, 10);
      const cur = map.get(key) || { points: 0, count: 0 };
      cur.points += r.points || 0;
      cur.count++;
      map.set(key, cur);
    }
    return map;
  }, [races]);

  const cells = useMemo(() => {
    const today = new Date();
    const cells: { date: string; points: number; count: number; day: number; week: number }[] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const info = byDate.get(key) || { points: 0, count: 0 };
      const dayOfWeek = d.getDay();
      const msDiff = d.getTime() - start.getTime();
      const week = Math.floor(msDiff / (7 * 86400000));
      cells.push({ date: key, points: info.points, count: info.count, day: dayOfWeek, week });
    }
    return cells;
  }, [byDate]);

  const maxPoints = Math.max(1, ...cells.map((c) => c.points));

  function color(points: number, count: number) {
    if (count === 0) return dark ? "bg-zinc-800" : "bg-zinc-100";
    const intensity = Math.min(1, points / maxPoints);
    if (dark) {
      const darkLevels = ["bg-green-900/60", "bg-green-800", "bg-green-700", "bg-green-600", "bg-green-500", "bg-green-400"];
      const idx = Math.min(darkLevels.length - 1, Math.floor(intensity * darkLevels.length));
      return darkLevels[idx];
    }
    const lightLevels = ["bg-green-200", "bg-green-300", "bg-green-400", "bg-green-500", "bg-green-600", "bg-green-700"];
    const idx = Math.min(lightLevels.length - 1, Math.floor(intensity * lightLevels.length));
    return lightLevels[idx];
  }

  function checkColor(points: number) {
    if (points > maxPoints * 0.4) return "text-white";
    return "text-green-800";
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  const weekCount = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((l, i) => (
            <div key={i} className="h-[14px] text-[10px] leading-[14px] text-zinc-400 w-8 text-right pr-1">
              {l}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {Array.from({ length: weekCount }, (_, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const c = cells.find((c) => c.week === w && c.day === day);
                if (!c) return <div key={day} className="w-[14px] h-[14px] rounded-sm bg-transparent" />;
                return (
                  <div
                    key={day}
                    title={`${c.date} — ${c.count} race${c.count !== 1 ? "s" : ""}, ${c.points} pts`}
                    className={`w-[14px] h-[14px] rounded-sm relative flex items-center justify-center ${color(c.points, c.count)}`}
                  >
                    {c.count > 0 && (
                      <Check size={10} className={checkColor(c.points)} strokeWidth={3} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<Metric>("speed");
  const [raceLimit, setRaceLimit] = useState<number | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const chartRef = useRef<any>(null);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(`Network error: ${err.message}. Make sure the server is running on port 1384.`);
      }
    } finally {
      setLoading(false);
    }
  }, [input, apiKey]);

  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(toDate(e.activeLabel));
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (!refAreaLeft || !e?.activeLabel) return;
    setRefAreaRight(toDate(e.activeLabel));
  }, [refAreaLeft]);

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

  const allChartData = useMemo(() => {
    if (!data?.races.length) return [];
    return [...data.races]
      .sort((a, b) => toDate(a.date) - toDate(b.date))
      .map((r) => ({
        ...r,
        dateLabel: formatDate(r.date),
        ts: toDate(r.date),
      }));
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
      const avgSpeed = slice.reduce((s, r) => s + r.speed, 0) / slice.length;
      const avgAcc = slice.reduce((s, r) => s + r.accuracy, 0) / slice.length;
      const wins = slice.filter((r) => r.won).length;
      cumPoints += d.points || 0;
      return {
        ...d,
        rollingSpeed: +avgSpeed.toFixed(1),
        rollingAcc: +avgAcc.toFixed(1),
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
    return { slope, intercept, line: values.map((_, i) => +(intercept + slope * i).toFixed(1)) };
  }, [rollingData, selectedMetric]);

  const timeframeStats = useMemo(() => {
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

  const chartDataWithRegression = useMemo(() => {
    if (!regression) return rollingData;
    return rollingData.map((d, i) => ({
      ...d,
      regressionLine: regression.line[i],
    }));
  }, [rollingData, regression]);

  const lineColor = selectedMetric === "speed" ? "#8884d8" : selectedMetric === "accuracy" ? "#82ca9d" : "#ffc658";
  const regressionColor = selectedMetric === "speed" ? "#4c3fa8" : "#3a8a5a";

  const raceLimitOptions = [1000, 500, 200, 100, 50, 20];
  const maxRaces = data?.races.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 transition-colors">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
        {/* Header + Theme Toggle */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold">TypeRacer Stats</h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto w-full flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Username or profile link..."
              className="flex-1 p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 text-sm"
              disabled={loading}
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <Key size={14} />
              {showApiKey ? "Hide API Key" : "Enter API Key (optional)"}
            </button>
            <span className="text-xs text-zinc-400">
              — Get yours at{" "}
              <a
                href="https://data.typeracer.com/pit/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                data.typeracer.com/pit/api_keys
              </a>
            </span>
          </div>
          {showApiKey && (
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your TypeRacer API key..."
                className="w-full p-3 pr-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}
        </form>

        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-xl font-bold">{data.name}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  @{data.username}
                  {data.premium && <span className="ml-2 text-amber-500">Premium</span>}
                </p>
                {data.joinedAt && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Joined {new Date(data.joinedAt).toLocaleDateString()}
                  </p>
                )}
                {data.note && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 max-w-md">{data.note}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    data.qotdDone
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  QOTD: {data.qotdDone ? "Done" : "Not Done"}
                </div>
              </div>
            </div>

            {data.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Races", value: data.stats.totalRaces.toLocaleString() },
                  { label: "Total Wins", value: data.stats.totalWins.toLocaleString() },
                  { label: "Avg WPM", value: data.stats.avgWpm?.toFixed(1) ?? "—" },
                  { label: "Best WPM", value: data.stats.bestWpm?.toFixed(1) ?? "—" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {data.races.length > 0 && (
              <>
                {/* Metric selector */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {(["speed", "accuracy", "points"] as Metric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedMetric(m)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                          selectedMetric === m
                            ? "bg-zinc-900 text-white"
                            : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    <span className="w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />
                    {raceLimitOptions.map((limit) => (
                      <button
                        key={limit}
                        onClick={() => setRaceLimit(raceLimit === limit ? null : limit)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                          raceLimit === limit
                            ? "bg-zinc-900 text-white"
                            : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {maxRaces > limit ? `Last ${limit}` : limit}
                      </button>
                    ))}
                    {raceLimit && (
                      <button
                        onClick={() => setRaceLimit(null)}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        All
                      </button>
                    )}
                  </div>
                  {chartRef.current && (
                    <button
                      onClick={handleZoomOut}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Reset Zoom
                    </button>
                  )}
                </div>

                {/* Timeframe stats */}
                {timeframeStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: "Races", value: timeframeStats.races },
                      { label: "Avg Speed", value: `${timeframeStats.avgSpeed} wpm` },
                      { label: "Avg Accuracy", value: `${timeframeStats.avgAcc}%` },
                      { label: "Wins", value: `${timeframeStats.wins} (${timeframeStats.winRate}%)` },
                      { label: "Points Gained", value: timeframeStats.totalPoints },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center"
                      >
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
                        <p className="text-sm font-bold">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Main chart */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      {selectedMetric === "speed" ? "Speed" : selectedMetric === "accuracy" ? "Accuracy" : "Points"} Over Time
                    </h3>
                    {regression && (
                      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        Trend: {regression.slope > 0 ? "+" : ""}{regression.slope.toFixed(4)} per race
                        {" "}({(regression.slope * 100).toFixed(2)} per 100 races)
                      </span>
                    )}
                  </div>
                  <div className="h-72 sm:h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartDataWithRegression}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} domain={[selectedMetric === "accuracy" ? 80 : "auto", "auto"]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey={selectedMetric === "speed" ? "rollingSpeed" : selectedMetric === "accuracy" ? "rollingAcc" : "cumulativePoints"}
                          name={selectedMetric === "speed" ? "Speed (10-race avg)" : selectedMetric === "accuracy" ? "Accuracy (10-race avg)" : "Cumulative Points"}
                          stroke={lineColor}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        {selectedMetric === "speed" && (
                          <Line
                            type="monotone"
                            dataKey="winsPer10"
                            name="Wins per 10 races"
                            stroke="#ff7300"
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={{ r: 3 }}
                          />
                        )}
                        {regression && selectedMetric !== "points" && (
                          <Line
                            type="linear"
                            dataKey="regressionLine"
                            name={`Trend (${regression.slope > 0 ? "+" : ""}${regression.slope.toFixed(4)}/race)`}
                            stroke={regressionColor}
                            strokeWidth={1.5}
                            strokeDasharray="6 3"
                            dot={false}
                            activeDot={false}
                          />
                        )}
                        {refAreaLeft && refAreaRight && (
                          <ReferenceArea
                            x1={formatDate(new Date(Math.min(refAreaLeft, refAreaRight)).toISOString())}
                            x2={formatDate(new Date(Math.max(refAreaLeft, refAreaRight)).toISOString())}
                            stroke="#8884d8"
                            strokeDasharray="4 4"
                            fill="#8884d8"
                            fillOpacity={0.1}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 text-center">
                    Drag on the chart to select a timeframe. Averages update automatically.
                  </p>
                </div>

                {/* Daily Activity Heatmap */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                  <h3 className="text-sm font-semibold mb-3 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Daily Activity
                  </h3>
                  <ActivityHeatmap races={data.races} dark={dark} />
                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-zinc-400">
                    <span>Less</span>
                    <div className="flex gap-[2px]">
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-green-900/40" : "bg-green-100"}`} />
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-green-700" : "bg-green-300"}`} />
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-green-600" : "bg-green-500"}`} />
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-green-500" : "bg-green-600"}`} />
                      <div className={`w-3 h-3 rounded-sm ${dark ? "bg-green-400" : "bg-green-700"}`} />
                    </div>
                    <span>More</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-50 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}
