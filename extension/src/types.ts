export interface ExtensionRace {
  id: string;
  date: string;
  speed: number;
  accuracy: number;
  points: number | null;
  rank: number;
  totalRacers: number;
  textId: number;
  won: boolean;
  mode?: string;
  quoteText?: string;
}

export interface QuoteHistoryRecord {
  textId: number;
  quoteText: string;
  timesTyped: number;
  lastSpeed: number;
  lastAccuracy: number;
  bestSpeed: number;
  lastDate: string;
}

export interface StreakInfo {
  racesDoneToday: number;
  racesRemaining: number;
  targetDaily: number;
  qotdDone: boolean;
  bestWpmToday: number | null;
  secondsUntilReset: number;
  formattedCountdown: string;
}

export interface OverlaySettings {
  notifyOneHourBefore: boolean;
  showSparkline: boolean;
  collapsed: boolean;
  position: { x: number; y: number };
  username?: string;
  apiKey?: string;
  themeMode?: "auto" | "light" | "dark";
  hideUpsells?: boolean;
  enableSnapping?: boolean;
  autoMinimizeOnRace?: boolean;
  autoHideTopBar?: boolean;
  transparentOverlay?: boolean;
  wideMode?: boolean;
  snapMode?: "left-dock" | "right-dock" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none";
  dimensions?: { width: number; height: number };
}

export function isCompetitiveRace(r: ExtensionRace): boolean {
  if (r.mode) {
    const m = r.mode.toLowerCase();
    if (m.includes("qotd") || m.includes("practice") || m.includes("solo") || m.includes("quote")) {
      return false;
    }
  }
  return (r.totalRacers ?? 0) > 1 || !r.mode || r.mode.toLowerCase().includes("multiplayer");
}

const MONTH_ABBR: Record<number, string> = {
  0: "JA", 1: "FE", 2: "MR", 3: "AP", 4: "MA", 5: "JN",
  6: "JL", 7: "AG", 8: "SE", 9: "OC", 10: "NV", 11: "DE",
};

export function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mo = MONTH_ABBR[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mo}/${dd}/${yyyy}`;
}

export function parseApiRace(r: any): ExtensionRace {
  return {
    id: String(r.rid),
    date: r.t ? (typeof r.t === "number" ? new Date(r.t * 1000).toISOString() : String(r.t)) : new Date().toISOString(),
    speed: Number(Number(r.wpm).toFixed(1)),
    accuracy: r.acc != null ? Number((r.acc * (r.acc <= 1 ? 100 : 1)).toFixed(1)) : 100,
    points: r.pts != null ? Number(r.pts) : null,
    rank: r.r || 1,
    totalRacers: r.nr || 1,
    textId: r.tid || 0,
    won: r.r === 1,
    mode: r.gn || r.mode || "multiplayer",
  };
}
