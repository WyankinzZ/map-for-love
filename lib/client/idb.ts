/**
 * Pure client-side IndexedDB key-value storage.
 * Provides high-capacity, zero-configuration local persistence
 * for mobile APKs (Capacitor) and offline environments.
 */

const DB_NAME = "map_of_us_mobile_db";
const STORE_NAME = "kv_store";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function idbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? (req.result as T) : fallback);
      };
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[idb] Failed to write", key, err);
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[idb] Failed to delete", key, err);
  }
}

import { Capacitor } from "@capacitor/core";

/**
 * Detects whether the app is running in a static APK/mobile environment
 * (Capacitor or static bundle where Next.js /api/ routes are not running).
 */
export function isMobileStaticApp(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}

  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) return true;

  const protocol = window.location.protocol;
  if (protocol === "capacitor:" || protocol === "file:") return true;

  // In Android Capacitor WebView, origin is typically http://localhost (port is empty)
  if (window.location.hostname === "localhost" && !window.location.port) {
    return true;
  }

  return false;
}

/**
 * Detects whether the app is running in an Electron desktop environment.
 */
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes("electron")) return true;
    const w = window as unknown as { process?: { type?: string } };
    if (w.process?.type === "renderer") return true;
  } catch {}

  return false;
}
