import type { MemoryChange, MemorySnapshot } from "@/lib/store/memory";
import { memoryPersistence, type Persistence } from "./local";

const DB_NAME = "sums";
const DB_VERSION = 1;
const CHANNEL = "sums:data";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Speichern abgebrochen"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("versions")) db.createObjectStore("versions", { keyPath: "id" });
    // Money-flow boards from earlier versions stay in their store until the board comes back.
    if (!db.objectStoreNames.contains("simulations")) db.createObjectStore("simulations", { keyPath: "id" });
    if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
  };
  return promisify(req);
}

/**
 * IndexedDB storage for local mode. Falls back to memory when the browser
 * refuses IndexedDB (some private windows): the app works, but nothing is kept.
 */
export async function indexedDbPersistence(): Promise<Persistence> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return memoryPersistence();
  }
  // Ask the browser not to evict the data under storage pressure. Granted silently or not at all.
  void navigator.storage?.persist?.().catch(() => {});
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;

  return {
    persistent: true,
    async load(): Promise<MemorySnapshot> {
      const tx = db.transaction(["versions", "meta"], "readonly");
      const [versions, head] = await Promise.all([
        promisify(tx.objectStore("versions").getAll()),
        promisify(tx.objectStore("meta").get("head")),
      ]);
      return { versions, head: typeof head === "number" ? head : null };
    },
    async save(changes: MemoryChange[]) {
      const tx = db.transaction(["versions", "meta"], "readwrite");
      for (const c of changes) {
        if (c.store === "meta") tx.objectStore("meta").put(c.head, "head");
        else tx.objectStore("versions").put(c.row);
      }
      await done(tx);
    },
    announce: () => channel?.postMessage("changed"),
    listen: (onChange) => {
      if (channel) channel.onmessage = () => onChange();
    },
  };
}
