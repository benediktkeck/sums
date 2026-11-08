import { defineConfig } from "drizzle-kit";
import { env } from "../../packages/core/src/env";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: env("DB_PATH") ?? "data/sums.db" },
});
