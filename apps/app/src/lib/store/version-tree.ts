import { calculate } from "@sums/core/engine/calculate";
import { emptyPlan } from "@sums/core/model/empty";
import { parsePlan } from "@sums/core/model/parse";
import type { Plan } from "@sums/core/model/schema";
import type { HistoryEntry, PlanState, VersionMeta } from "@/lib/api-types";
import { ConflictError, NotFoundError } from "./errors";

/** Edits with the same coalesce key within this window merge into one version. */
export const COALESCE_WINDOW_MS = 15_000;

/** One stored plan version. `data` is the plan JSON. */
export type VersionRow = {
  id: number;
  createdAt: number;
  updatedAt: number;
  label: string | null;
  data: string;
  parentId: number | null;
  summary: string | null;
  coalesceKey: string | null;
};

/**
 * Synchronous storage for plan versions. Implemented by SQLite on the server
 * and by an in-memory table (persisted to IndexedDB) in the browser.
 */
export interface VersionRepo {
  get(id: number): VersionRow | undefined;
  insert(row: Omit<VersionRow, "id">): VersionRow;
  update(id: number, patch: Partial<Omit<VersionRow, "id">>): VersionRow | undefined;
  newestChild(id: number): VersionRow | undefined;
  /** Newest first. */
  list(opts: { limit: number; labeledOnly: boolean }): VersionRow[];
  getHead(): number | null;
  setHead(id: number): void;
  transaction<T>(fn: () => T): T;
}

export type CommitInput = {
  baseId: number;
  data: unknown;
  summary?: string | null;
  coalesceKey?: string | null;
};

function meta(row: VersionRow): VersionMeta {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    label: row.label,
    summary: row.summary,
    parentId: row.parentId,
  };
}

/**
 * The plan's version history. Every committed edit is a version; versions form
 * a tree through `parentId`. Undo moves the head to the parent, redo to the
 * newest child. Nothing is ever deleted; restoring appends a new version.
 */
export class VersionTree {
  constructor(
    private readonly repo: VersionRepo,
    private readonly now: () => number = Date.now,
  ) {}

  private insert(plan: Plan, parentId: number | null, summary: string | null, coalesceKey: string | null): VersionRow {
    const t = this.now();
    const row = this.repo.insert({
      createdAt: t,
      updatedAt: t,
      label: null,
      data: JSON.stringify(plan),
      parentId,
      summary,
      coalesceKey,
    });
    this.repo.setHead(row.id);
    return row;
  }

  private head(): VersionRow {
    const id = this.repo.getHead();
    const row = id != null ? this.repo.get(id) : undefined;
    if (row) return row;
    // First start: seed an empty plan.
    return this.insert(emptyPlan(), null, "Neuer Plan", null);
  }

  private stateOf(row: VersionRow): PlanState {
    return {
      head: meta(row),
      plan: parsePlan(JSON.parse(row.data)),
      canUndo: row.parentId != null && this.repo.get(row.parentId) != null,
      canRedo: this.repo.newestChild(row.id) != null,
    };
  }

  getState(): PlanState {
    return this.stateOf(this.head());
  }

  /** Stores an edit. Throws ConflictError when `baseId` is not the current head. */
  commit(input: CommitInput): PlanState {
    return this.repo.transaction(() => {
      const head = this.head();
      if (head.id !== input.baseId) throw new ConflictError(head.id);
      const plan = parsePlan(input.data);
      const key = input.coalesceKey ?? null;
      const t = this.now();
      const canCoalesce =
        key != null &&
        head.coalesceKey === key &&
        head.label == null &&
        t - head.updatedAt < COALESCE_WINDOW_MS &&
        this.repo.newestChild(head.id) == null;
      if (canCoalesce) {
        const row = this.repo.update(head.id, { data: JSON.stringify(plan), summary: input.summary ?? head.summary, updatedAt: t });
        return this.stateOf(row!);
      }
      return this.stateOf(this.insert(plan, head.id, input.summary ?? null, key));
    });
  }

  undo(): PlanState {
    return this.repo.transaction(() => {
      const head = this.head();
      if (head.parentId != null && this.repo.get(head.parentId)) this.repo.setHead(head.parentId);
      return this.getState();
    });
  }

  redo(): PlanState {
    return this.repo.transaction(() => {
      const child = this.repo.newestChild(this.head().id);
      if (child) this.repo.setHead(child.id);
      return this.getState();
    });
  }

  /** Restoring creates a new version (child of the current head) with the old data. */
  restore(id: number): PlanState {
    return this.repo.transaction(() => {
      const src = this.repo.get(id);
      if (!src) throw new NotFoundError(`Version ${id} nicht gefunden`);
      const head = this.head();
      const name = src.label ? `„${src.label}“` : `Version ${id}`;
      return this.stateOf(this.insert(parsePlan(JSON.parse(src.data)), head.id, `${name} wiederhergestellt`, null));
    });
  }

  /** Replaces the whole plan (e.g. import) as a new version. */
  replace(data: unknown, summary: string): PlanState {
    return this.repo.transaction(() => {
      const plan = parsePlan(data);
      const head = this.head();
      return this.stateOf(this.insert(plan, head.id, summary, null));
    });
  }

  /** Names a version (save state) or removes the name with `null`. */
  setLabel(id: number, label: string | null): VersionMeta {
    const row = this.repo.update(id, { label: label?.trim() || null });
    if (!row) throw new NotFoundError(`Version ${id} nicht gefunden`);
    return meta(row);
  }

  /** Newest first, with the free amount of each version for context. */
  history(opts: { limit?: number; labeledOnly?: boolean } = {}): HistoryEntry[] {
    const headId = this.head().id;
    const rows = this.repo.list({ limit: opts.limit ?? 200, labeledOnly: opts.labeledOnly ?? false });
    return rows.map((row) => {
      let free: number | null = null;
      try {
        free = calculate(parsePlan(JSON.parse(row.data))).free;
      } catch {
        free = null;
      }
      return { ...meta(row), isHead: row.id === headId, free };
    });
  }

  getVersion(id: number): { meta: VersionMeta; plan: Plan } {
    const row = this.repo.get(id);
    if (!row) throw new NotFoundError(`Version ${id} nicht gefunden`);
    return { meta: meta(row), plan: parsePlan(JSON.parse(row.data)) };
  }
}
