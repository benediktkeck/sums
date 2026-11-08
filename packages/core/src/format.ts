const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const num2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** `1.234,56 €` */
export function formatEur(n: number): string {
  // Avoid "-0,00 €" for tiny negative rounding noise.
  return eur.format(Math.abs(n) < 0.005 ? 0 : n);
}

/** `1.234,56` (no currency sign), for inputs. */
export function formatAmount(n: number): string {
  return num2.format(Math.abs(n) < 0.005 ? 0 : n);
}

export function formatNumber(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${pct.format((part / total) * 100)} %`;
}

/** Signed delta, e.g. `+12,00 €` / `−5,00 €` (typographic minus). */
export function formatDelta(n: number): string {
  if (Math.abs(n) < 0.005) return "±0,00 €";
  const s = eur.format(Math.abs(n));
  return n > 0 ? `+${s}` : `−${s}`;
}

/**
 * Parses German-formatted user input: `1.234,56`, `1234,56`, `1234.56`, `55 €`.
 * Returns null when the input is not a number.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s ]/g, "").replace(/−/g, "-");
  if (s === "" || s === "-") return null;
  const hasComma = s.includes(",");
  if (hasComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
