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
  secondsUntilReset: number;
  formattedCountdown: string;
}

export interface OverlaySettings {
  notifyOneHourBefore: boolean;
  showSparkline: boolean;
  collapsed: boolean;
  position: { x: number; y: number };
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
