import type { VersionRepo, VersionRow } from "./version-tree";

/** Everything the browser store keeps; also the shape persisted to IndexedDB. */
export type MemorySnapshot = {
  versions: VersionRow[];
  head: number | null;
};

/** A change to persist: a version row written, or the head moved. */
export type MemoryChange =
  | { store: "versions"; row: VersionRow }
  | { store: "meta"; head: number };

/**
 * In-memory tables for local mode. Reads and writes are synchronous so the
 * shared VersionTree logic runs unchanged; every write is
 * reported through `onChange` so the caller can persist it.
 */
export class MemoryTables {
  private versions = new Map<number, VersionRow>();
  private head: number | null = null;
  private nextVersion = 1;

  constructor(
    snapshot: MemorySnapshot = { versions: [], head: null },
    private readonly onChange: (c: MemoryChange) => void = () => {},
  ) {
    this.load(snapshot);
  }

  load(snapshot: MemorySnapshot) {
    this.versions = new Map(snapshot.versions.map((r) => [r.id, r]));
    this.head = snapshot.head;
    this.nextVersion = Math.max(0, ...this.versions.keys()) + 1;
  }

  snapshot(): MemorySnapshot {
    return { versions: [...this.versions.values()], head: this.head };
  }

  readonly versionRepo: VersionRepo = {
    get: (id) => this.versions.get(id),
    insert: (values) => {
      const row = { ...values, id: this.nextVersion++ };
      this.versions.set(row.id, row);
      this.onChange({ store: "versions", row });
      return row;
    },
    update: (id, patch) => {
      const cur = this.versions.get(id);
      if (!cur) return undefined;
      const row = { ...cur, ...patch, id };
      this.versions.set(id, row);
      this.onChange({ store: "versions", row });
      return row;
    },
    newestChild: (id) => {
      let best: VersionRow | undefined;
      for (const r of this.versions.values()) if (r.parentId === id && (!best || r.id > best.id)) best = r;
      return best;
    },
    list: ({ limit, labeledOnly }) =>
      [...this.versions.values()]
        .filter((r) => !labeledOnly || r.label != null)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit),
    getHead: () => this.head,
    setHead: (id) => {
      this.head = id;
      this.onChange({ store: "meta", head: id });
    },
    // Every operation validates before it writes, so there is nothing to roll back.
    transaction: (fn) => fn(),
  };
}
