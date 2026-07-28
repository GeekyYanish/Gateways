import { DataError } from "../types";

/**
 * localStorage access layer.
 *
 * Every read and write funnels through here so that:
 *  - keys are namespaced and versioned in one place
 *  - a quota error or Safari private-mode throw cannot crash a render
 *  - cross-tab change notification is centralised
 *
 * Storage failure is treated as a real, expected condition rather than an
 * impossibility: Safari in private mode throws on setItem, and users do fill
 * their quota.
 */

const NS = "parallax";
export const SCHEMA_VERSION = 1;

export type Collection =
  | "profiles"
  | "credentials"
  | "roles"
  | "characters"
  | "colleges"
  | "departments"
  | "categories"
  | "events"
  | "registrations"
  | "teams"
  | "teamMembers"
  | "attendance"
  | "achievements"
  | "userAchievements"
  | "xpLedger"
  | "levels"
  | "announcements"
  | "schedule"
  | "sponsors"
  | "session"
  | "meta"
  | "paymentReceipts";

function key(c: Collection): string {
  return `${NS}:v${SCHEMA_VERSION}:${c}`;
}

/** True when localStorage is actually usable (not just present). */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = `${NS}:probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * In-memory fallback so the app still works (for the session) when storage is
 * unavailable. Data is lost on reload, which is strictly better than crashing.
 */
const memory = new Map<string, string>();
let warnedUnavailable = false;

function rawGet(k: string): string | null {
  if (typeof window === "undefined") return memory.get(k) ?? null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return memory.get(k) ?? null;
  }
}

function rawSet(k: string, v: string): void {
  if (typeof window === "undefined") {
    memory.set(k, v);
    return;
  }
  try {
    window.localStorage.setItem(k, v);
  } catch (err) {
    memory.set(k, v);
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn(
        "[store] localStorage is unavailable (private mode or quota exceeded). " +
          "Falling back to in-memory storage; data will not survive a reload.",
        err,
      );
    }
  }
}

/** Read a collection. Returns `fallback` when absent or corrupt. */
export function read<T>(c: Collection, fallback: T): T {
  const raw = rawGet(key(c));
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON (interrupted write, manual devtools edit). Do not throw
    // during a render — reset the collection and carry on.
    console.warn(`[store] ${c} contained invalid JSON; resetting it.`);
    rawSet(key(c), JSON.stringify(fallback));
    return fallback;
  }
}

export function readList<T>(c: Collection): T[] {
  const v = read<T[]>(c, []);
  return Array.isArray(v) ? v : [];
}

/** Write a collection and notify same-tab listeners. */
export function write<T>(c: Collection, value: T): void {
  rawSet(key(c), JSON.stringify(value));
  emitLocal(c);
}

export function remove(c: Collection): void {
  if (typeof window === "undefined") {
    memory.delete(key(c));
    return;
  }
  try {
    window.localStorage.removeItem(key(c));
  } catch {
    memory.delete(key(c));
  }
  emitLocal(c);
}

/** Wipe every Parallax key — used by the dev reset button. */
export function clearAll(): void {
  if (typeof window === "undefined") {
    memory.clear();
    return;
  }
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(`${NS}:`)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    memory.clear();
  }
}

// ---------------------------------------------------------------------------
// Change notification
// ---------------------------------------------------------------------------

/**
 * The native `storage` event fires only in OTHER tabs, never the one that wrote.
 * To get a single consistent signal, writes emit locally as well, and remote
 * changes are forwarded from the `storage` listener.
 */
type Listener = (c: Collection) => void;
const listeners = new Set<Listener>();

function emitLocal(c: Collection) {
  listeners.forEach((l) => {
    try {
      l(c);
    } catch (err) {
      console.error("[store] listener threw", err);
    }
  });
}

let storageBound = false;

function bindStorageEvent() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(`${NS}:v${SCHEMA_VERSION}:`)) return;
    const c = e.key.split(":").pop() as Collection | undefined;
    if (c) emitLocal(c);
  });
}

/** Subscribe to collection changes in this tab and others. */
export function subscribe(listener: Listener): () => void {
  bindStorageEvent();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Throw if storage is unusable AND the caller requires durability. */
export function assertStorage(): void {
  if (typeof window !== "undefined" && !isStorageAvailable() && !warnedUnavailable) {
    throw new DataError(
      "STORAGE_UNAVAILABLE",
      "Browser storage is unavailable. Sign-in cannot persist.",
    );
  }
}
