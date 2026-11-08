import { MemoryTables, type MemoryChange, type MemorySnapshot } from "@/lib/store/memory";
import { VersionTree } from "@/lib/store/version-tree";
import type { Backend } from "./types";

/** Durable storage behind the in-memory tables (IndexedDB in the browser, a stub in tests). */
export interface Persistence {
  readonly persistent: boolean;
  load(): Promise<MemorySnapshot>;
  save(changes: MemoryChange[]): Promise<void>;
  /** Tells other tabs that the data changed. */
  announce(): void;
  /** Registers the handler for changes announced by other tabs. */
  listen(onChange: () => void): void;
}

/**
 * Local mode: plan versions live in this browser. The shared VersionTree
 * runs on in-memory tables; every operation's
 * writes are persisted before its promise resolves.
 */
export class LocalBackend implements Backend {
  readonly mode = "local" as const;
  private readonly tables: MemoryTables;
  private readonly tree: VersionTree;
  private changes: MemoryChange[] = [];
  /** Another tab wrote; reload from storage before the next operation. */
  private stale = false;
  private readonly listeners = new Set<() => void>();
  /** Operations run one at a time so a reload never interleaves with a write. */
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly store: Persistence,
    snapshot: MemorySnapshot,
    now: () => number,
  ) {
    this.tables = new MemoryTables(snapshot, (c) => this.changes.push(c));
    this.tree = new VersionTree(this.tables.versionRepo, now);
    store.listen(() => {
      this.stale = true;
      this.listeners.forEach((fn) => fn());
    });
  }

  static async open(store: Persistence, now: () => number = Date.now): Promise<LocalBackend> {
    return new LocalBackend(store, await store.load(), now);
  }

  get persistent() {
    return this.store.persistent;
  }

  private run<T>(fn: () => T): Promise<T> {
    const next = this.chain.then(async () => {
      if (this.stale) {
        this.tables.load(await this.store.load());
        this.stale = false;
      }
      this.changes = [];
      const result = fn();
      const changes = this.changes;
      this.changes = [];
      if (changes.length) {
        try {
          await this.store.save(changes);
        } catch (err) {
          // Memory is ahead of storage now; reload so both agree again.
          this.stale = true;
          throw err;
        }
        this.store.announce();
      }
      return result;
    });
    this.chain = next.catch(() => {});
    return next;
  }

  getState = () => this.run(() => this.tree.getState());
  commit: Backend["commit"] = (input) => this.run(() => this.tree.commit(input));
  undo = () => this.run(() => this.tree.undo());
  redo = () => this.run(() => this.tree.redo());
  replace: Backend["replace"] = (plan, summary) => this.run(() => this.tree.replace(plan, summary));
  history: Backend["history"] = (opts) => this.run(() => this.tree.history(opts));
  restore: Backend["restore"] = (id) => this.run(() => this.tree.restore(id));
  setLabel: Backend["setLabel"] = (id, label) => this.run(() => this.tree.setLabel(id, label));

  onExternalChange(listener: () => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}

/** Keeps everything in memory only (tests, or a browser that refuses storage). */
export function memoryPersistence(initial?: MemorySnapshot): Persistence & { data: MemorySnapshot } {
  const data: MemorySnapshot = structuredClone(initial ?? { versions: [], head: null });
  return {
    persistent: false,
    data,
    load: async () => structuredClone(data),
    save: async (changes) => {
      for (const c of changes) {
        if (c.store === "meta") data.head = c.head;
        else data.versions = [...data.versions.filter((r) => r.id !== c.row.id), c.row];
      }
    },
    announce: () => {},
    listen: () => {},
  };
}
