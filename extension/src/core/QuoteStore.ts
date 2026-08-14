import type { ExtensionRace, QuoteHistoryRecord } from "../types";
import { parseApiRace } from "../types";

const DB_NAME = "typeracer_db";
const DB_VERSION = 1;
const STORE_RACES = "races";
const STORE_QUOTES = "quotes_history";

export class QuoteStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private recentRacesMemory: ExtensionRace[] = [];

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return reject(new Error("IndexedDB unavailable"));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RACES)) {
          const store = db.createObjectStore(STORE_RACES, { keyPath: "id" });
          store.createIndex("username", "username", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("textId", "textId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_QUOTES)) {
          const store = db.createObjectStore(STORE_QUOTES, { keyPath: "textId" });
          store.createIndex("quoteText", "quoteText", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  public async syncFromAPI(username: string): Promise<ExtensionRace[]> {
    if (!username) return [];

    let fetchedRaces: ExtensionRace[] = [];

    // 1. Chrome Extension Background Messaging (Bypasses CORS via Service Worker)
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
      try {
        const res: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "FETCH_RACES", username }, (response) => {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (res && res.success && Array.isArray(res.races) && res.races.length > 0) {
          fetchedRaces = res.races;
        }
      } catch {
        // Ignore extension background messaging error
      }
    }

    // 2. Tampermonkey GM_xmlhttpRequest Fallback (Bypasses CORS for Userscript)
    if (fetchedRaces.length === 0 && typeof (window as any).GM_xmlhttpRequest === "function") {
      try {
        const jsonText: string = await new Promise((resolve, reject) => {
          (window as any).GM_xmlhttpRequest({
            method: "GET",
            url: `https://data.typeracer.com/api/v1/racers/${encodeURIComponent(username)}/races?universe=play&n=50`,
            onload: (res: any) => resolve(res.responseText),
            onerror: (err: any) => reject(err),
          });
        });
        const rawRaces = JSON.parse(jsonText);
        if (Array.isArray(rawRaces)) {
          fetchedRaces = rawRaces.map(parseApiRace);
        }
      } catch {
        // Ignore GM fetch error
      }
    }

    // 3. Direct fetch fallback
    if (fetchedRaces.length === 0) {
      try {
        const res = await fetch(`https://data.typeracer.com/api/v1/racers/${encodeURIComponent(username)}/races?universe=play&n=50`);
        if (res.ok) {
          const json = await res.json();
          const rawRaces = Array.isArray(json) ? json : [];
          fetchedRaces = rawRaces.map(parseApiRace);
        }
      } catch {
        // Quietly swallow CORS error in page context
      }
    }

    if (fetchedRaces.length > 0) {
      this.recentRacesMemory = fetchedRaces;
      try {
        localStorage.setItem("tr_overlay_recent_races", JSON.stringify(fetchedRaces.slice(0, 50)));
      } catch {
        // ignore
      }
      for (const r of fetchedRaces) {
        await this.saveRace(r, username);
      }
      return fetchedRaces;
    }

    return [];
  }

  public async saveRace(race: ExtensionRace, username: string = "local_user"): Promise<void> {
    if (!this.recentRacesMemory.some((r) => r.id === race.id)) {
      this.recentRacesMemory.unshift(race);
      if (this.recentRacesMemory.length > 50) {
        this.recentRacesMemory.pop();
      }
    }

    try {
      const db = await this.initDB();
      const tx = db.transaction([STORE_RACES, STORE_QUOTES], "readwrite");

      // 1. Save Race record
      const raceStore = tx.objectStore(STORE_RACES);
      raceStore.put({ ...race, username: username.toLowerCase() });

      // 2. Update Quote History record
      if (race.textId) {
        const quoteStore = tx.objectStore(STORE_QUOTES);
        const getReq = quoteStore.get(race.textId);
        getReq.onsuccess = () => {
          const existing: QuoteHistoryRecord = getReq.result || {
            textId: race.textId,
            quoteText: "",
            timesTyped: 0,
            lastSpeed: 0,
            lastAccuracy: 0,
            bestSpeed: 0,
            lastDate: "",
          };

          const updated: QuoteHistoryRecord = {
            textId: race.textId,
            quoteText: existing.quoteText || "",
            timesTyped: existing.timesTyped + 1,
            lastSpeed: race.wpm,
            lastAccuracy: race.accuracy ?? 98.0,
            bestSpeed: Math.max(existing.bestSpeed, race.wpm),
            lastDate: race.dateStr,
          };
          quoteStore.put(updated);
        };
      }
    } catch (err) {
      console.warn("[TypeRacer Overlay] Failed to save race to IndexedDB:", err);
    }

    // Save to localStorage as quick fallback
    try {
      const stored = JSON.parse(localStorage.getItem("tr_overlay_recent_races") || "[]");
      if (!stored.some((r: any) => r.id === race.id)) {
        stored.unshift(race);
        localStorage.setItem("tr_overlay_recent_races", JSON.stringify(stored.slice(0, 50)));
      }
    } catch {
      // Fallback ignore
    }
  }

  public async getQuoteHistory(textId: number): Promise<QuoteHistoryRecord | null> {
    if (!textId) return null;
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_QUOTES, "readonly");
        const req = tx.objectStore(STORE_QUOTES).get(textId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async getRecentRaces(limit = 10): Promise<ExtensionRace[]> {
    if (this.recentRacesMemory.length > 0) {
      return this.recentRacesMemory.slice(0, limit);
    }

    // Try localStorage fallback first (Instant on browser reload)
    try {
      const stored: ExtensionRace[] = JSON.parse(localStorage.getItem("tr_overlay_recent_races") || "[]");
      if (stored.length > 0) {
        this.recentRacesMemory = stored;
        return stored.slice(0, limit);
      }
    } catch {
      // ignore
    }

    // Fallback to IndexedDB
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_RACES, "readonly");
        const store = tx.objectStore(STORE_RACES);
        const req = store.getAll();
        req.onsuccess = () => {
          const all: ExtensionRace[] = req.result || [];
          all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (all.length > 0) {
            this.recentRacesMemory = all;
          }
          resolve(all.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
}
