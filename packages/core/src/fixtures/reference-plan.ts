import { DEFAULT_WEEKS_PER_MONTH, SCHEMA_VERSION, type Expense, type Interval, type Plan } from "../model/schema";

/**
 * Synthetic reference plan for the golden tests (the demo for visitors is
 * demo-plan.ts). All names and amounts are made up; the expected totals in
 * calculate.test.ts are worked out by hand from these numbers.
 *
 * Switch state: parental leave off, second car given up, tax class change
 * off, new job on.
 */
export function referencePlan(): Plan {
  let n = 0;
  const exp = (
    name: string,
    provider: string,
    interval: Interval,
    amount: number,
    categoryId: string,
    active = true,
    extra: Partial<Expense> = {},
  ): Expense => ({
    id: `exp-${++n}`,
    name,
    provider,
    interval,
    amount,
    categoryId,
    active,
    condition: null,
    notes: "",
    ...extra,
  });
  const carB = { condition: { switchId: "sw-car", when: "off" as const } };

  return {
    schemaVersion: SCHEMA_VERSION,
    persons: [
      { id: "p-a", name: "Person A", color: "#e0795a", officeDaysPerWeek: 4, commuteKm: 30, carId: "car-p-a" },
      { id: "p-b", name: "Person B", color: "#3f9c8a", officeDaysPerWeek: 2, commuteKm: 25, carId: "car-p-b" },
    ],
    cars: [
      { id: "car-p-a", name: "Auto Person A", consumption: 6, fuelType: "e10" },
      { id: "car-p-b", name: "Auto Person B", consumption: 5, fuelType: "e10" },
    ],
    incomes: [
      { id: "inc-a", label: "Person A", personId: "p-a", amount: 3100, active: true, condition: null },
      { id: "inc-b", label: "Person B", personId: "p-b", amount: 2400, active: true, condition: null },
      { id: "inc-parental", label: "Elterngeld", personId: null, amount: 1500, active: false, condition: null },
      { id: "inc-child", label: "Kindergeld", personId: null, amount: 255, active: false, condition: null },
    ],
    categories: [
      { id: "cat-home", name: "Wohnung", color: "var(--c1)" },
      { id: "cat-ins", name: "Versicherung", color: "var(--c3)" },
      { id: "cat-car", name: "Auto", color: "var(--c2)" },
      { id: "cat-fin", name: "Finanzierung", color: "var(--c4)" },
      { id: "cat-sub", name: "Abo", color: "var(--c5)" },
    ],
    expenses: [
      exp("Miete", "Vermietung", "monthly", 1200, "cat-home"),
      exp("Nebenkosten", "Hausverwaltung", "monthly", 180, "cat-home"),
      exp("Strom", "Stromanbieter", "monthly", 85, "cat-home"),
      exp("Internet", "Internetanbieter", "monthly", 40, "cat-home"),
      exp("Rundfunkbeitrag", "Beitragsservice", "quarterly", 55.08, "cat-home"),
      exp("Hausratversicherung", "Versicherer 1", "yearly", 96, "cat-ins"),
      exp("Haftpflichtversicherung", "Versicherer 2", "yearly", 72, "cat-ins"),
      exp("Zahnzusatzversicherung", "Versicherer 3", "monthly", 25, "cat-ins"),
      exp("Berufsunfähigkeit Person A", "Versicherer 4", "monthly", 65, "cat-ins"),
      exp("Kfz-Versicherung Auto B", "Versicherer 5", "monthly", 45, "cat-car", true, carB),
      exp("Kfz-Steuer Auto B", "Bundeskasse", "yearly", 120, "cat-car", true, carB),
      exp("Kreditrate Auto B", "Autobank", "monthly", 210, "cat-car", true, carB),
      exp("Kfz-Versicherung Auto A", "Versicherer 5", "yearly", 540, "cat-car"),
      exp("Kfz-Steuer Auto A", "Bundeskasse", "yearly", 84, "cat-car"),
      exp("Pannenhilfe", "Automobilclub", "yearly", 60, "cat-car"),
      exp("Ratenkredit", "Bank 1", "monthly", 150, "cat-fin"),
      exp("Bausparvertrag", "Bausparkasse", "monthly", 50, "cat-fin"),
      exp("Videostreaming", "Videodienst", "monthly", 12.99, "cat-sub", false),
      exp("Musikstreaming", "Musikdienst", "monthly", 10.99, "cat-sub"),
      exp("Cloud-Speicher", "Cloudanbieter", "yearly", 29.99, "cat-sub"),
      exp("Zeitungsabo", "Verlag", "monthly", 14.99, "cat-sub"),
    ],
    variableCosts: [
      { id: "var-fuel-a", label: "Tanken Person A", kind: "commute-fuel", personId: "p-a", active: true, condition: null },
      { id: "var-fuel-b", label: "Tanken Person B", kind: "commute-fuel", personId: "p-b", active: true, condition: null },
      { id: "var-food", label: "Lebensmittel", kind: "fixed", amount: 650, active: true, condition: null },
      { id: "var-household", label: "Drogerie & Haushalt", kind: "fixed", amount: 90, active: true, condition: null },
    ],
    savings: [
      { id: "sav-car", name: "Auto", amount: 100, active: true, condition: null, accountId: null },
      { id: "sav-etf", name: "ETF-Sparplan", amount: 250, active: true, condition: null, accountId: null },
      { id: "sav-travel", name: "Urlaub", amount: 120, active: true, condition: null, accountId: null },
      { id: "sav-home", name: "Anschaffungen", amount: 80, active: true, condition: null, accountId: null },
      { id: "sav-emergency", name: "Notgroschen", amount: 150, active: true, condition: null, accountId: null },
    ],
    accounts: [],
    switches: [
      {
        id: "sw-parental",
        name: "Elternzeit Person A",
        on: false,
        effects: [
          { id: "e1", type: "set", target: { entity: "income", id: "inc-a", field: "amount" }, value: 0 },
          { id: "e2", type: "enable", entity: "income", targetId: "inc-parental" },
          { id: "e3", type: "enable", entity: "income", targetId: "inc-child" },
          { id: "e4", type: "set", target: { entity: "person", id: "p-a", field: "officeDaysPerWeek" }, value: 0 },
        ],
      },
      { id: "sw-car", name: "Auto B abgeschafft", on: true, effects: [] },
      {
        id: "sw-tax",
        name: "Steuerklasse wechseln",
        on: false,
        effects: [{ id: "e5", type: "set", target: { entity: "income", id: "inc-b", field: "amount" }, value: 2650 }],
      },
      {
        id: "sw-job",
        name: "Neuer Job Person B",
        on: true,
        effects: [{ id: "e6", type: "set", target: { entity: "income", id: "inc-b", field: "amount" }, value: 2900 }],
      },
    ],
    settings: {
      fuelPriceE10: 1.8,
      fuelPriceDiesel: 1.7,
      allowanceCap: 200,
      weeksPerMonth: DEFAULT_WEEKS_PER_MONTH,
      surplusAccountId: null,
      splitMode: "equal",
      commute: true,
    },
  };
}
