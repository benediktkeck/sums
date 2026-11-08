import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { NotFoundError } from "@/lib/store/errors";
import { storageMode } from "../config";
import { dbPath } from "./path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/** Opens (and migrates) a database. Use ":memory:" for tests. */
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

const globalForDb = globalThis as unknown as { sumsDb?: Db };

export { dbPath } from "./path";

/** Process-wide database. */
export function getDb(): Db {
  // Local mode keeps data in the browser; the API has nothing to serve.
  if (storageMode() === "local") throw new NotFoundError("Im lokalen Modus speichert der Server keine Daten.");
  globalForDb.sumsDb ??= openDb(dbPath());
  return globalForDb.sumsDb;
}
