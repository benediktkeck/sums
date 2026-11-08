import { describe, expect, it } from "vitest";
import { demoPlan } from "../fixtures/demo-plan";
import { referencePlan } from "../fixtures/reference-plan";
import { parsePlan } from "../model/parse";
import type { Plan } from "../model/schema";
import { calculate, calculateWithSwitch, commuteFuelCost, monthlyEquivalent } from "./calculate";

const cents = (n: number) => Math.round(n * 100) / 100;

function withSwitch(plan: Plan, id: string, on: boolean): Plan {
  return { ...plan, switches: plan.switches.map((s) => (s.id === id ? { ...s, on } : s)) };
}

describe("monthlyEquivalent", () => {
  it("divides by the interval length", () => {
    expect(monthlyEquivalent(120, "monthly")).toBe(120);
    expect(monthlyEquivalent(120, "quarterly")).toBe(40);
    expect(monthlyEquivalent(120, "half-yearly")).toBe(20);
    expect(monthlyEquivalent(120, "yearly")).toBe(10);
  });
});

/*
 * Golden numbers for the reference plan, worked out by hand:
 *   income    3100 + 2900 (new job overrides 2400)                         = 6000.00
 *   fixed     home 1505 · insurance 90 · car 0 (car B off) · finance 200
 *             · subscriptions 25.98                                          = 1820.98
 *   periodic  55.08/3 + 96/12 + 72/12 + 540/12 + 84/12 + 60/12 + 29.99/12   =   91.86
 *   fuel A    4 days × 2 × 52/12 wk × 30 km / 100 × 6 l × 1.80 €           =  112.32
 *   fuel B    2 days × 2 × 52/12 wk × 25 km / 100 × 5 l × 1.80 €           =   39.00
 *   variable  112.32 + 39 + 650 + 90                                         =  891.32
 *   savings   91.86 + buckets 700                                            =  791.86
 *   free      6000 − 1820.98 − 891.32 − 791.86                               = 2495.84
 *   allowance 200 each (capped) · surplus 2495.84 − 400                      = 2095.84
 */
describe("golden test: reference plan", () => {
  const r = calculate(referencePlan());

  it("computes the totals", () => {
    expect(cents(r.income.total)).toBe(6000);
    expect(cents(r.fixed.total)).toBe(1820.98);
    expect(cents(r.variable.total)).toBe(891.32);
    expect(cents(r.periodic)).toBe(91.86);
    expect(cents(r.savings.total)).toBe(791.86);
    expect(cents(r.free)).toBe(2495.84);
    expect(r.allowance.perPerson).toEqual({ "p-a": 200, "p-b": 200 });
    expect(cents(r.surplus)).toBe(2095.84);
    expect(r.shortfall).toBe(0);
  });

  it("computes the fixed costs per category", () => {
    const c = r.fixed.byCategory;
    expect(cents(c["cat-home"])).toBe(1505);
    expect(cents(c["cat-ins"])).toBe(90);
    expect(cents(c["cat-car"])).toBe(0);
    expect(cents(c["cat-sub"])).toBe(25.98);
    expect(cents(c["cat-fin"])).toBe(200);
  });

  it("computes the fuel lines with 52/12 weeks per month", () => {
    expect(cents(r.variable.items["var-fuel-a"])).toBe(112.32);
    expect(cents(r.variable.items["var-fuel-b"])).toBe(39);
  });

  it("keeps non-monthly expenses out of fixed costs", () => {
    const tvLicence = r.expenses["exp-5"];
    expect(tvLicence.bucket).toBe("reserve");
    expect(cents(tvLicence.monthly)).toBe(18.36);
  });

  it("explains items disabled by a scenario condition", () => {
    const loanB = r.status.expense["exp-12"];
    expect(loanB.active).toBe(false);
    expect(loanB.reason).toMatchObject({ kind: "condition", switchId: "sw-car" });
  });

  it("lets the later switch win (new job beats the tax class change)", () => {
    const plan = withSwitch(referencePlan(), "sw-tax", true);
    expect(calculate(plan).income.items["inc-b"]).toBe(2900);
    expect(calculate(withSwitch(plan, "sw-job", false)).income.items["inc-b"]).toBe(2650);
    expect(calculate(withSwitch(referencePlan(), "sw-job", false)).income.items["inc-b"]).toBe(2400);
  });

  it("records overrides with the original value", () => {
    expect(r.overrides["income:inc-b:amount"]).toMatchObject({ original: 2400, value: 2900, switchId: "sw-job" });
  });

  it("previews the parental-leave scenario", () => {
    // income 0 + 2900 + 1500 + 255 = 4655; no commute for A: variable 779
    // free 4655 − 1820.98 − 779 − 791.86 = 1263.16; surplus 863.16
    const p = calculateWithSwitch(referencePlan(), "sw-parental", true);
    expect(cents(p.income.total)).toBe(4655);
    expect(p.variable.items["var-fuel-a"]).toBe(0);
    expect(p.status.income["inc-parental"]).toMatchObject({ active: true, reason: { kind: "effect" } });
    expect(cents(p.free)).toBe(1263.16);
    expect(cents(p.surplus)).toBe(863.16);
  });

  it("re-enables car items when the car switch is off", () => {
    const p = calculate(withSwitch(referencePlan(), "sw-car", false));
    expect(cents(p.fixed.byCategory["cat-car"])).toBe(255);
    expect(cents(p.periodic)).toBe(101.86);
    expect(p.status.expense["exp-12"]).toEqual({ active: true, reason: null });
  });

  it("does not mutate the input plan", () => {
    const plan = referencePlan();
    const before = JSON.stringify(plan);
    calculate(plan);
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe("commute fuel", () => {
  const plan = referencePlan();
  const r = calculate(plan);

  it("uses the configured weeks per month", () => {
    const p = structuredClone(plan);
    p.settings.weeksPerMonth = 4;
    const items = calculate(p).variable.items;
    expect(cents(items["var-fuel-a"])).toBe(103.68); // 4 × 2 × 4 × 0.30 × 6 × 1.80
    expect(cents(items["var-fuel-b"])).toBe(36); // 2 × 2 × 4 × 0.25 × 5 × 1.80
  });

  it("uses each car's own fuel price", () => {
    const p = structuredClone(plan);
    p.cars[1].fuelType = "diesel";
    expect(cents(calculate(p).variable.items["var-fuel-b"])).toBe(36.83); // 39 / 1.80 × 1.70
  });

  it("commuteFuelCost follows the formula", () => {
    const person = plan.persons[0];
    expect(commuteFuelCost(person, plan.cars[0], plan.settings)).toBeCloseTo(4 * 2 * (52 / 12) * 0.3 * 6 * 1.8, 10);
  });

  it("charges nothing without a car", () => {
    const p = structuredClone(plan);
    p.persons[1].carId = null;
    expect(calculate(p).variable.items["var-fuel-b"]).toBe(0);
    expect(calculate(p).variable.items["var-fuel-a"]).toBeCloseTo(r.variable.items["var-fuel-a"], 10);
  });

  it("uses the shared car for everyone who drives it", () => {
    const p = structuredClone(plan);
    p.persons[1].carId = p.persons[0].carId;
    const items = calculate(p).variable.items;
    expect(cents(items["var-fuel-b"])).toBe(46.8); // 2 × 2 × 52/12 × 0.25 × 6 × 1.80
  });

  it("lets a switch change a car's consumption", () => {
    const p = structuredClone(plan);
    p.switches.push({
      id: "sw-eco",
      name: "Sparsames Auto",
      on: true,
      effects: [{ id: "e-eco", type: "set", target: { entity: "car", id: "car-p-a", field: "consumption" }, value: 3 }],
    });
    const res = calculate(p);
    expect(res.variable.items["var-fuel-a"]).toBeCloseTo(r.variable.items["var-fuel-a"] / 2, 10);
    expect(res.overrides["car:car-p-a:consumption"]).toMatchObject({ original: 6, value: 3 });
  });
});

describe("allowance and shortfall", () => {
  it("splits a small free amount evenly below the cap", () => {
    const plan = referencePlan();
    plan.incomes[0].amount = 3100 - calculate(referencePlan()).free + 300; // free = 300
    const r = calculate(plan);
    expect(cents(r.free)).toBe(300);
    expect(cents(r.allowance.perPerson["p-a"])).toBe(150);
    expect(cents(r.surplus)).toBe(0);
  });

  it("reports a shortfall and no allowance when free is negative", () => {
    const plan = referencePlan();
    plan.incomes[0].amount = 0;
    const r = calculate(plan);
    expect(r.free).toBeLessThan(0);
    expect(cents(r.shortfall)).toBe(cents(-r.free));
    expect(r.allowance.total).toBe(0);
    expect(r.surplus).toBe(0);
  });

  it("handles a plan without persons", () => {
    const plan = referencePlan();
    plan.persons = [];
    const r = calculate(plan);
    expect(r.allowance.total).toBe(0);
    expect(r.variable.items["var-fuel-a"]).toBe(0);
    expect(cents(r.surplus)).toBe(cents(r.free));
  });
});

describe("effects", () => {
  it("disable effect overrides the item's own flag and names the switch", () => {
    const plan = referencePlan();
    plan.switches.push({
      id: "sw-x",
      name: "Sparen",
      on: true,
      effects: [{ id: "x", type: "disable", entity: "savings", targetId: "sav-etf" }],
    });
    const r = calculate(plan);
    expect(r.savings.items["sav-etf"]).toBe(0);
    expect(r.status.savings["sav-etf"].reason).toMatchObject({ kind: "effect", switchName: "Sparen" });
  });

  it("can override settings", () => {
    const plan = referencePlan();
    plan.switches.push({
      id: "sw-y",
      name: "Mehr Taschengeld",
      on: true,
      effects: [{ id: "y", type: "set", target: { entity: "settings", field: "allowanceCap" }, value: 400 }],
    });
    const r = calculate(plan);
    expect(r.allowance.perPerson["p-a"]).toBe(400);
  });

  it("ignores effects that point to deleted items", () => {
    const plan = referencePlan();
    plan.switches[3].effects.push({
      id: "z",
      type: "set",
      target: { entity: "expense", id: "missing", field: "amount" },
      value: 1,
    });
    expect(cents(calculate(plan).free)).toBe(2495.84);
  });
});

describe("split modes", () => {
  function plan(mode: Plan["settings"]["splitMode"], cap = 10_000): Plan {
    const p = referencePlan();
    p.switches = p.switches.map((s) => ({ ...s, on: false }));
    p.incomes = p.incomes.map((i) => (i.id === "inc-a" ? { ...i, amount: 6000 } : i.id === "inc-b" ? { ...i, amount: 2000 } : i));
    return { ...p, settings: { ...p.settings, splitMode: mode, allowanceCap: cap } };
  }

  it("equal: everyone gets the same share, capped", () => {
    const r = calculate(plan("equal", 100));
    expect(r.allowance.perPerson).toEqual({ "p-a": 100, "p-b": 100 });
    expect(cents(r.allowance.share["p-a"])).toBe(cents(r.free / 2));
    expect(cents(r.surplus)).toBe(cents(r.free - 200));
  });

  it("income: shares follow each person's counted income", () => {
    const r = calculate(plan("income"));
    expect(r.free).toBeGreaterThan(0);
    expect(cents(r.allowance.perPerson["p-a"])).toBe(cents(r.free * 0.75));
    expect(cents(r.allowance.perPerson["p-b"])).toBe(cents(r.free * 0.25));
    expect(cents(r.surplus)).toBe(0);
  });

  it("income: incomes without a person and inactive incomes don't count", () => {
    const p = plan("income");
    p.incomes = p.incomes.map((i) => (i.id === "inc-parental" ? { ...i, active: true } : i.id === "inc-b" ? { ...i, active: false } : i));
    const r = calculate(p);
    expect(cents(r.allowance.perPerson["p-a"])).toBe(cents(r.free));
    expect(r.allowance.perPerson["p-b"]).toBe(0);
  });

  it("income: without assigned income it falls back to an equal split", () => {
    const p = plan("income");
    p.incomes = p.incomes.map((i) => ({ ...i, personId: null }));
    const r = calculate(p);
    expect(cents(r.allowance.perPerson["p-a"])).toBe(cents(r.free / 2));
  });

  it("none: no pocket money, the free amount is surplus", () => {
    const r = calculate(plan("none"));
    expect(r.allowance.total).toBe(0);
    expect(r.allowance.share).toEqual({ "p-a": 0, "p-b": 0 });
    expect(cents(r.surplus)).toBe(cents(r.free));
  });

  it("a shortfall gives nobody pocket money in any mode", () => {
    for (const mode of ["equal", "income", "none"] as const) {
      const p = plan(mode);
      p.incomes = p.incomes.map((i) => ({ ...i, amount: 100 }));
      const r = calculate(p);
      expect(r.free).toBeLessThan(0);
      expect(r.allowance.total).toBe(0);
      expect(r.surplus).toBe(0);
    }
  });
});

describe("demo plan", () => {
  it("is valid, leaves money free and shows a capped and an uncapped person", () => {
    const plan = parsePlan(JSON.parse(JSON.stringify(demoPlan())));
    const r = calculate(plan);
    expect(r.free).toBeGreaterThan(0);
    expect(r.allowance.perPerson["demo-alex"]).toBe(plan.settings.allowanceCap);
    expect(r.allowance.perPerson["demo-sam"]).toBeLessThan(plan.settings.allowanceCap);
    // Every scenario changes the result.
    for (const sw of plan.switches) expect(calculateWithSwitch(plan, sw.id, true).free).not.toBe(r.free);
  });
});
