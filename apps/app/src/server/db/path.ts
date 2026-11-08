import path from "node:path";
import { env } from "@sums/core/env";

/** SUMS_DB_PATH, default `data/sums.db`. No database import, so the proxy can use it. */
export function dbPath(): string {
  return env("DB_PATH") ?? path.join(process.cwd(), "data", "sums.db");
}
