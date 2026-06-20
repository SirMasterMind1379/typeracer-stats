/** A single typing race result. */
export interface Race {
  id: string;
  /** ISO date string of when the race occurred. */
  date: string;
  /** Typing speed in WPM. */
  speed: number;
  /** Accuracy as a percentage (0–100). */
  accuracy: number;
  /** Points earned from this race. */
  points: number | null;
  /** Finishing rank (1 = first). */
  rank: number;
  /** Number of racers in the session. */
  totalRacers: number;
  /** Identifier for the text typed. */
  textId: number;
  /** Whether the user placed first. */
  won: boolean;
  /** Race mode (e.g., "multiplayer", "room", "qotd"). */
  mode?: string;
}

/** Aggregate stats for a universe (scrape or API). */
export interface Stats {
  totalRaces: number;
  totalWins?: number;
  points?: number | null;
  avgWpm: number | null;
  bestWpm: number | null;
  certWpm?: number | null;
  /** Typist level from scraped profile (e.g. "Typist 5"). */
  typistLevel?: string | null;
}

/** Full response from the user-stats API. */
export interface UserData {
  username: string;
  name: string;
  joinedAt: string | null;
  premium: boolean;
  /** Badge IDs scraped from the profile page. */
  badges?: string[];
  stats: Stats | null;
  races: Race[];
  qotdDone: boolean;
  note?: string;
}

/** Which metric is currently selected for the chart. */
export type Metric = "speed" | "accuracy" | "points" | "wins";

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

/** Computed stats for the currently visible timeframe. */
export interface TimeframeStats {
  races: number;
  avgSpeed: string;
  avgAcc: string;
  wins: number;
  totalPoints: string;
  winRate: string;
}
