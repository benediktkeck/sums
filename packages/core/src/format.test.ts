import { describe, expect, it } from "vitest";
import { formatDelta, formatEur, parseAmount } from "./format";

describe("format", () => {
  it("formats euros in de-DE", () => {
    expect(formatEur(1234.5).replace(/ /g, " ")).toBe("1.234,50 €");
    expect(formatEur(-0.001).replace(/ /g, " ")).toBe("0,00 €");
  });
  it("formats deltas with a sign", () => {
    expect(formatDelta(-5).replace(/ /g, " ")).toBe("−5,00 €");
    expect(formatDelta(12).replace(/ /g, " ")).toBe("+12,00 €");
  });
  it("parses German and plain number input", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1234,5")).toBe(1234.5);
    expect(parseAmount("55 €")).toBe(55);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
