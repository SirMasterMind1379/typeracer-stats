import type { ExtensionRace, QuoteHistoryRecord } from "../types";
import { parseApiRace, isSameRace } from "../types";

const DB_NAME = "typeracer_overlay_db";
const DB_VERSION = 2;
const STORE_RACES = "overlay_races";
const STORE_QUOTES = "overlay_quotes";

export class QuoteStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private recentRacesMemory: ExtensionRace[] = [];

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_RACES)) {
          const raceStore = db.createObjectStore(STORE_RACES, { keyPath: "id" });
          raceStore.createIndex("textId", "textId", { unique: false });
          raceStore.createIndex("timestamp", "timestamp", { unique: false });
          raceStore.createIndex("username", "username", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_QUOTES)) {
          const quoteStore = db.createObjectStore(STORE_QUOTES, { keyPath: "textId" });
          quoteStore.createIndex("textId", "textId", { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  public async syncFromAPI(username: string): Promise<ExtensionRace[]> {
    if (!username) return [];

    let fetchedRaces: ExtensionRace[] = [];

    // 1. Extension Service Worker Messaging Fallback (Bypasses CORS)
    if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        const res: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "FETCH_RACES", username }, (response) => {
            if (typeof chrome !== "undefined" && chrome.runtime?.lastError) {
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
      const mergedList: ExtensionRace[] = [...fetchedRaces];
      for (const r of this.recentRacesMemory) {
        if (!mergedList.some((m) => isSameRace(m, r))) {
          mergedList.push(r);
        }
      }
      mergedList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.recentRacesMemory = mergedList.slice(0, 50);

      try {
        localStorage.setItem("tr_overlay_recent_races", JSON.stringify(this.recentRacesMemory));
      } catch {
        // ignore
      }

      for (const r of fetchedRaces) {
        await this.saveRace(r, username);
      }
      return this.recentRacesMemory;
    }

    return [];
  }

  public async saveRace(race: ExtensionRace, username: string = "local_user"): Promise<void> {
    const existingIndex = this.recentRacesMemory.findIndex((r) => isSameRace(r, race));
    if (existingIndex >= 0) {
      this.recentRacesMemory[existingIndex] = { ...this.recentRacesMemory[existingIndex], ...race };
    } else {
      this.recentRacesMemory.unshift(race);
      if (this.recentRacesMemory.length > 50) {
        this.recentRacesMemory.pop();
      }
    }
    this.recentRacesMemory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

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
      const idx = stored.findIndex((r: any) => r.id === race.id);
      if (idx >= 0) {
        stored[idx] = race;
      } else {
        stored.unshift(race);
      }
      stored.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      localStorage.setItem("tr_overlay_recent_races", JSON.stringify(stored.slice(0, 50)));
    } catch {
      // Fallback ignore
    }
  }

  public async getQuoteHistory(textId: number): Promise<QuoteHistoryRecord | null> {
    if (!textId) return null;

    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_RACES, STORE_QUOTES], "readonly");
        const raceStore = tx.objectStore(STORE_RACES);
        const index = raceStore.index("textId");
        const req = index.getAll(textId);

        req.onsuccess = () => {
          const races: ExtensionRace[] = req.result || [];
          if (races.length > 0) {
            // Sort chronologically (oldest to newest)
            races.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const wpms = races.map((r) => r.wpm).filter((w) => w > 0);
            const accuracies = races.map((r) => r.accuracy ?? 98.0);
            const bestSpeed = Math.max(...wpms, 0);
            const lastRace = races[races.length - 1];

            const record: QuoteHistoryRecord = {
              textId,
              quoteText: "",
              timesTyped: races.length,
              lastSpeed: lastRace.wpm,
              lastAccuracy: lastRace.accuracy ?? 98.0,
              bestSpeed,
              lastDate: lastRace.dateStr,
            };
            resolve(record);
          } else {
            // Fallback check in quotes_history table
            const qStore = tx.objectStore(STORE_QUOTES);
            const qReq = qStore.get(textId);
            qReq.onsuccess = () => resolve(qReq.result || null);
            qReq.onerror = () => resolve(null);
          }
        };

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

    // Try localStorage fallback (Instant on browser reload)
    try {
      const stored = JSON.parse(localStorage.getItem("tr_overlay_recent_races") || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        const parsed = stored.map(parseApiRace);
        parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.recentRacesMemory = parsed;
        return parsed.slice(0, limit);
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
