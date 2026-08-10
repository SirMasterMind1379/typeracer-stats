import type { ExtensionRace, QuoteHistoryRecord } from "../types";

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
          store.createIndex("date", "date", { unique: false });
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

  public async saveRace(race: ExtensionRace, username: string = "local_user"): Promise<void> {
    // Add to memory list
    this.recentRacesMemory.unshift(race);
    if (this.recentRacesMemory.length > 50) {
      this.recentRacesMemory.pop();
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
            quoteText: race.quoteText || "",
            timesTyped: 0,
            lastSpeed: 0,
            lastAccuracy: 0,
            bestSpeed: 0,
            lastDate: "",
          };

          const updated: QuoteHistoryRecord = {
            textId: race.textId,
            quoteText: race.quoteText || existing.quoteText || "",
            timesTyped: existing.timesTyped + 1,
            lastSpeed: race.speed,
            lastAccuracy: race.accuracy,
            bestSpeed: Math.max(existing.bestSpeed, race.speed),
            lastDate: race.date,
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
      stored.unshift(race);
      localStorage.setItem("tr_overlay_recent_races", JSON.stringify(stored.slice(0, 20)));
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
    if (this.recentRacesMemory.length >= limit) {
      return this.recentRacesMemory.slice(0, limit);
    }
    
    // Try localStorage fallback first
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
          all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          this.recentRacesMemory = all;
          resolve(all.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
}
