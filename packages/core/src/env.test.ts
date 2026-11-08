import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./env";

describe("env", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads SUMS_ settings", () => {
    vi.stubEnv("SUMS_TEST_A", "value");
    expect(env("TEST_A")).toBe("value");
    expect(env("TEST_MISSING")).toBeUndefined();
  });
});
