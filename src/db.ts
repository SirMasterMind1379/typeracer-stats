import type { Race, UserData } from "./types";

const DB_NAME = "typeracer_db";
const DB_VERSION = 1;
const STORE_RACES = "races";
const STORE_PROFILES = "profiles";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RACES)) {
        const store = db.createObjectStore(STORE_RACES, { keyPath: "id" });
        store.createIndex("username", "username", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: "username" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedRaces(username: string): Promise<Race[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_RACES, "readonly");
      const store = tx.objectStore(STORE_RACES);
      const index = store.index("username");
      const req = index.getAll(username.toLowerCase());
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveCachedRaces(username: string, races: Race[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RACES, "readwrite");
    const store = tx.objectStore(STORE_RACES);
    const u = username.toLowerCase();
    for (const r of races) {
      store.put({ ...r, username: u });
    }
  } catch (err) {
    console.warn("IndexedDB save failed:", err);
  }
}

export async function getCachedProfile(username: string): Promise<UserData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROFILES, "readonly");
      const req = tx.objectStore(STORE_PROFILES).get(username.toLowerCase());
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedProfile(username: string, data: UserData): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PROFILES, "readwrite");
    tx.objectStore(STORE_PROFILES).put({ username: username.toLowerCase(), data, updatedAt: Date.now() });
  } catch (err) {
    console.warn("IndexedDB profile save failed:", err);
  }
}
