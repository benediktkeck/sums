import { DEFAULT_WEEKS_PER_MONTH, SCHEMA_VERSION, type Plan } from "./schema";

export const CATEGORY_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c-var)"];
/** Fixed order (validated categorical palette); assign by account index, never cycled per render. */
export const ACCOUNT_COLORS = ["var(--acc-1)", "var(--acc-2)", "var(--acc-3)", "var(--acc-4)", "var(--acc-5)", "var(--acc-6)"];
export const PERSON_COLORS = ["#e0795a", "#3f9c8a", "#7c6fe0", "#d4a72c"];

export function emptyPlan(): Plan {
  return {
    schemaVersion: SCHEMA_VERSION,
    persons: [],
    cars: [],
    incomes: [],
    categories: [
      { id: "cat-home", name: "Wohnung", color: CATEGORY_COLORS[0] },
      { id: "cat-ins", name: "Versicherung", color: CATEGORY_COLORS[2] },
      { id: "cat-car", name: "Auto", color: CATEGORY_COLORS[1] },
      { id: "cat-fin", name: "Finanzierung", color: CATEGORY_COLORS[3] },
      { id: "cat-sub", name: "Abos", color: CATEGORY_COLORS[4] },
    ],
    expenses: [],
    variableCosts: [],
    savings: [],
    accounts: [],
    switches: [],
    settings: {
      fuelPriceE10: 1.75,
      fuelPriceDiesel: 1.65,
      allowanceCap: 250,
      weeksPerMonth: DEFAULT_WEEKS_PER_MONTH,
      surplusAccountId: null,
      splitMode: "equal",
      commute: false,
    },
  };
}
