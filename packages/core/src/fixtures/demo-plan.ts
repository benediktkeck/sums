import { CATEGORY_COLORS, ACCOUNT_COLORS, PERSON_COLORS } from "../model/empty";
import { DEFAULT_WEEKS_PER_MONTH, SCHEMA_VERSION, type Expense, type Interval, type Plan } from "../model/schema";

/**
 * Example plan for first-time visitors: a fictional couple, Alex and Sam.
 * It shows every feature once: periodic payments, commute fuel, savings
 * accounts, an income-weighted split and three "what if" scenarios.
 */
export function demoPlan(): Plan {
  let n = 0;
  const exp = (name: string, provider: string, interval: Interval, amount: number, categoryId: string, extra: Partial<Expense> = {}): Expense => ({
    id: `demo-exp-${++n}`,
    name,
    provider,
    interval,
    amount,
    categoryId,
    active: true,
    condition: null,
    notes: "",
    ...extra,
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    persons: [
      { id: "demo-alex", name: "Alex", color: PERSON_COLORS[0], officeDaysPerWeek: 3, commuteKm: 24, carId: "demo-car" },
      { id: "demo-sam", name: "Sam", color: PERSON_COLORS[1], officeDaysPerWeek: 0, commuteKm: 0, carId: null },
    ],
    cars: [{ id: "demo-car", name: "Kombi", consumption: 6.4, fuelType: "e10" }],
    incomes: [
      { id: "demo-inc-alex", label: "Gehalt Alex", personId: "demo-alex", amount: 2900, active: true, condition: null },
      { id: "demo-inc-sam", label: "Gehalt Sam", personId: "demo-sam", amount: 2350, active: true, condition: null },
      { id: "demo-inc-parental", label: "Elterngeld Sam", personId: "demo-sam", amount: 1450, active: false, condition: null },
      { id: "demo-inc-child", label: "Kindergeld", personId: null, amount: 255, active: false, condition: null },
    ],
    categories: [
      { id: "demo-cat-home", name: "Wohnen", color: CATEGORY_COLORS[0] },
      { id: "demo-cat-ins", name: "Versicherungen", color: CATEGORY_COLORS[2] },
      { id: "demo-cat-mob", name: "Mobilität", color: CATEGORY_COLORS[1] },
      { id: "demo-cat-sub", name: "Abos & Verträge", color: CATEGORY_COLORS[4] },
    ],
    expenses: [
      exp("Miete (warm)", "Vermieter", "monthly", 1240, "demo-cat-home"),
      exp("Strom", "Stadtwerke", "monthly", 78, "demo-cat-home"),
      exp("Internet", "Provider", "monthly", 40, "demo-cat-home"),
      exp("Rundfunkbeitrag", "Beitragsservice", "quarterly", 55.08, "demo-cat-home"),
      exp("Hausrat", "Versicherer", "yearly", 96, "demo-cat-ins"),
      exp("Haftpflicht", "Versicherer", "yearly", 68, "demo-cat-ins"),
      exp("Berufsunfähigkeit Alex", "Versicherer", "monthly", 62, "demo-cat-ins"),
      exp("Kfz-Versicherung", "Versicherer", "yearly", 540, "demo-cat-mob"),
      exp("Kfz-Steuer", "Zoll", "yearly", 118, "demo-cat-mob"),
      exp("Deutschlandticket Sam", "Verkehrsverbund", "monthly", 63, "demo-cat-mob"),
      exp("Handyvertrag Alex", "Mobilfunk", "monthly", 15, "demo-cat-sub"),
      exp("Handyvertrag Sam", "Mobilfunk", "monthly", 12, "demo-cat-sub"),
      exp("Streaming", "Videodienst", "monthly", 13.99, "demo-cat-sub"),
      exp("Musik", "Musikdienst", "monthly", 10.99, "demo-cat-sub"),
      exp("Fitnessstudio", "Studio", "monthly", 35, "demo-cat-sub"),
    ],
    variableCosts: [
      { id: "demo-var-food", label: "Lebensmittel", kind: "fixed", amount: 620, active: true, condition: null },
      { id: "demo-var-drug", label: "Drogerie & Haushalt", kind: "fixed", amount: 70, active: true, condition: null },
      { id: "demo-var-fuel", label: "Tanken Alex", kind: "commute-fuel", personId: "demo-alex", active: true, condition: null },
      { id: "demo-var-fun", label: "Ausgehen & Freizeit", kind: "fixed", amount: 160, active: true, condition: null },
    ],
    savings: [
      { id: "demo-sav-emergency", name: "Notgroschen", amount: 200, active: true, condition: null, accountId: "demo-acc-cash" },
      { id: "demo-sav-holiday", name: "Urlaub", amount: 200, active: true, condition: null, accountId: "demo-acc-cash" },
      { id: "demo-sav-car", name: "Nächstes Auto", amount: 150, active: true, condition: null, accountId: "demo-acc-cash" },
      { id: "demo-sav-etf", name: "ETF-Sparplan", amount: 400, active: true, condition: null, accountId: "demo-acc-depot" },
    ],
    accounts: [
      { id: "demo-acc-cash", name: "Tagesgeld", kind: "account", color: ACCOUNT_COLORS[0], balance: 6500, rate: 2.25 },
      { id: "demo-acc-depot", name: "ETF-Depot", kind: "depot", color: ACCOUNT_COLORS[1], balance: 14000, rate: 6 },
    ],
    switches: [
      {
        id: "demo-sw-parental",
        name: "Elternzeit Sam",
        on: false,
        effects: [
          { id: "demo-e1", type: "set", target: { entity: "income", id: "demo-inc-sam", field: "amount" }, value: 0 },
          { id: "demo-e2", type: "enable", entity: "income", targetId: "demo-inc-parental" },
          { id: "demo-e3", type: "enable", entity: "income", targetId: "demo-inc-child" },
          { id: "demo-e4", type: "disable", entity: "expense", targetId: "demo-exp-10" },
        ],
      },
      {
        id: "demo-sw-move",
        name: "Größere Wohnung",
        on: false,
        effects: [
          { id: "demo-e5", type: "set", target: { entity: "expense", id: "demo-exp-1", field: "amount" }, value: 1580 },
          { id: "demo-e6", type: "set", target: { entity: "person", id: "demo-alex", field: "commuteKm" }, value: 9 },
        ],
      },
      {
        id: "demo-sw-raise",
        name: "Gehaltserhöhung Alex",
        on: false,
        effects: [{ id: "demo-e7", type: "set", target: { entity: "income", id: "demo-inc-alex", field: "amount" }, value: 3150 }],
      },
    ],
    settings: {
      fuelPriceE10: 1.75,
      fuelPriceDiesel: 1.65,
      allowanceCap: 800,
      weeksPerMonth: DEFAULT_WEEKS_PER_MONTH,
      surplusAccountId: "demo-acc-cash",
      splitMode: "income",
      commute: true,
    },
  };
}
