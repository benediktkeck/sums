import { describe, expect, it } from "vitest";
import { clientAddress, LOGIN_WINDOW_MS, LoginLimiter, MAX_FAILS_PER_CLIENT, MAX_FAILS_TOTAL } from "./login-limit";

describe("LoginLimiter", () => {
  it("blocks a client after too many failures until the window passes", () => {
    let now = 0;
    const l = new LoginLimiter(() => now);
    for (let i = 0; i < MAX_FAILS_PER_CLIENT; i++) l.fail("a");
    expect(l.allowed("a")).toBe(false);
    expect(l.allowed("b")).toBe(true);
    now += LOGIN_WINDOW_MS;
    expect(l.allowed("a")).toBe(true);
  });

  it("caps failures across all clients", () => {
    const l = new LoginLimiter(() => 0);
    for (let i = 0; i < MAX_FAILS_TOTAL; i++) l.fail(`c${i}`);
    expect(l.allowed("fresh")).toBe(false);
  });

  it("takes the address the nearest proxy saw", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientAddress(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientAddress(new Headers())).toBe("direct");
  });
});
