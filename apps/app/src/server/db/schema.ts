import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Every committed edit is one row. Versions form a tree through `parentId`:
 * undo moves the head to the parent, redo to the newest child. Nothing is
 * ever deleted; restoring an old version appends a new one.
 */
export const planVersions = sqliteTable("plan_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  /** Named save state ("Speicherstand") when set. */
  label: text("label"),
  /** Whole plan JSON document. */
  data: text("data").notNull(),
  parentId: integer("parent_id"),
  /** Human-readable change description, e.g. "Internet: 50,00 € → 55,00 €". */
  summary: text("summary"),
  /** Rapid edits with the same key are merged into one version. */
  coalesceKey: text("coalesce_key"),
});

/** Small key/value table; holds the current head version id. */
export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Money-flow boards (sandbox) from earlier versions. Not used right now; the
 * table stays so existing boards survive until the board comes back.
 */
export const simulations = sqliteTable("simulations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});
