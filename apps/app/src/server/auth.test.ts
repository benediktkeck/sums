import { beforeAll, describe, expect, it, vi } from "vitest";
import { isValidSession, safeEqual, safeNext, sessionToken } from "./auth";

// A fixed secret, so the tests never create the secret file next to a database.
beforeAll(() => vi.stubEnv("SUMS_SESSION_SECRET", "test-secret"));

describe("auth", () => {
  it("accepts only the token for the current password", async () => {
    const token = await sessionToken("geheim");
    expect(await isValidSession(token, "geheim")).toBe(true);
    expect(await isValidSession(token, "anders")).toBe(false);
    expect(await isValidSession(undefined, "geheim")).toBe(false);
    expect(token).not.toContain("geheim");
  });

  it("depends on the server secret, so a cookie alone doesn't reveal the password", async () => {
    const a = await sessionToken("pw", "secret-a");
    expect(a).not.toBe(await sessionToken("pw", "secret-b"));
    expect(a).not.toBe(await sessionToken("other", "secret-a"));
    expect(a).toBe(await sessionToken("pw", "secret-a"));
  });

  it("falls back to a password-derived key without a secret", async () => {
    expect(await sessionToken("pw", null)).toBe(await sessionToken("pw", null));
    expect(await sessionToken("pw", null)).not.toBe(await sessionToken("pw", "s"));
  });

  it("compares strings of any length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("only redirects to same-site paths after login", () => {
    expect(safeNext("/fixkosten?x=1")).toBe("/fixkosten?x=1");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
