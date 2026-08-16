export interface ExtensionRace {
  id: number;
  textId: number;
  wpm: number;
  accuracy?: number;
  rank?: number;
  racers?: number;
  timestamp: number;
  dateStr: string;
  mode?: string;
  points?: number;
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
  bestWpmToday: number | null;
  qotdDone: boolean;
  bestQotdToday: number | null;
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
  hideCursorWhileTyping?: boolean;
  disableRacerPopupsDuringRace?: boolean;
  hideLobbySocials?: boolean;
  snapMode?: "left-dock" | "right-dock" | "none";
  dimensions?: { width: number; height: number };
  dockedWidth?: number;
}

export function isCompetitiveRace(r: ExtensionRace): boolean {
  if (r.mode) {
    const m = r.mode.toLowerCase();
    if (m.includes("qotd") || m.includes("practice") || m.includes("solo") || m.includes("quote")) {
      return false;
    }
  }
  return true;
}

export function getToday00UTC(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function formatCountdown(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatDisplayDate(dateInput: string | number | Date): string {
  const MONTHS = ["JA", "FE", "MR", "AP", "MA", "JN", "JL", "AG", "SE", "OC", "NV", "DE"];
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const month = MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

export function parseApiRace(raw: any): ExtensionRace {
  const gn = raw.gn || raw.id || raw.rid || 0;
  const wpm = typeof raw.wpm === "number" ? raw.wpm : typeof raw.speed === "number" ? raw.speed : 0;
  const textId = raw.tid || raw.textId || 0;

  let timestamp = Date.now();
  if (typeof raw.t === "number") {
    timestamp = raw.t > 1e11 ? raw.t : raw.t * 1000;
  } else if (typeof raw.timestamp === "number") {
    timestamp = raw.timestamp > 1e11 ? raw.timestamp : raw.timestamp * 1000;
  } else if (raw.t && !isNaN(Number(raw.t))) {
    const n = Number(raw.t);
    timestamp = n > 1e11 ? n : n * 1000;
  } else if (raw.date) {
    const parsed = new Date(raw.date).getTime();
    if (!isNaN(parsed)) timestamp = parsed;
  } else if (raw.t && typeof raw.t === "string") {
    const parsed = new Date(raw.t).getTime();
    if (!isNaN(parsed)) timestamp = parsed;
  }

  const dateStr = formatDisplayDate(timestamp);
  const accuracy =
    typeof raw.ac === "number"
      ? Math.round(raw.ac * 1000) / 10
      : typeof raw.accuracy === "number"
      ? raw.accuracy
      : typeof raw.acc === "number"
      ? Math.round(raw.acc * 1000) / 10
      : undefined;
  const rank = raw.r || raw.rank || undefined;
  const racers = raw.nr || raw.racers || undefined;
  const mode = raw.mode || raw.gn_mode || (raw.universe === "play" ? "multiplayer" : raw.universe) || "multiplayer";
  const points = raw.pts || raw.points || undefined;

  return {
    id: gn,
    textId,
    wpm: Math.round(wpm * 10) / 10,
    accuracy,
    rank,
    racers,
    timestamp,
    dateStr,
    mode,
    points,
  };
}
