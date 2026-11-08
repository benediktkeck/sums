import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dbPath } from "./client";

describe("dbPath", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to data/sums.db", () => {
    vi.stubEnv("SUMS_DB_PATH", undefined);
    expect(dbPath()).toBe(path.join(process.cwd(), "data", "sums.db"));
  });

  it("uses an explicitly chosen file as is", () => {
    vi.stubEnv("SUMS_DB_PATH", "/srv/household.db");
    expect(dbPath()).toBe("/srv/household.db");
  });
});
