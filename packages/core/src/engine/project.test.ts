import { describe, expect, it } from "vitest";
import { referencePlan } from "../fixtures/reference-plan";
import type { Plan } from "../model/schema";
import { calculate } from "./calculate";
import { projectSavings } from "./project";

function withAccounts(): Plan {
  const plan = referencePlan();
  plan.accounts = [
    { id: "acc-tg", name: "Tagesgeld", kind: "account", color: "var(--acc-1)", balance: 1000, rate: 0 },
    { id: "acc-etf", name: "Depot", kind: "depot", color: "var(--acc-2)", balance: 0, rate: 6 },
  ];
  plan.savings = plan.savings.map((s) =>
    s.id === "sav-etf" ? { ...s, accountId: "acc-etf" } : s.id === "sav-emergency" || s.id === "sav-car" ? { ...s, accountId: "acc-tg" } : s,
  );
  return plan;
}

describe("projectSavings", () => {
  it("adds transfers linearly without interest", () => {
    const plan = withAccounts();
    const p = projectSavings(plan, calculate(plan), 12);
    const tg = p.accounts[0];
    expect(tg.monthly).toBe(250);
    expect(tg.series).toHaveLength(13);
    expect(tg.end).toBeCloseTo(1000 + 12 * 250, 6);
    expect(tg.interest).toBeCloseTo(0, 6);
  });

  it("compounds the annual rate monthly", () => {
    const plan = withAccounts();
    const p = projectSavings(plan, calculate(plan), 120);
    const depot = p.accounts[1];
    const r = 0.06 / 12;
    expect(depot.end).toBeCloseTo((250 * ((1 + r) ** 120 - 1)) / r, 6);
    expect(depot.deposits).toBe(30000);
    expect(depot.interest).toBeCloseTo(depot.end - 30000, 6);
    expect(p.total[120]).toBeCloseTo(p.accounts[0].end + depot.end, 6);
  });

  it("counts only active buckets and reports unassigned money", () => {
    const plan = withAccounts();
    plan.savings = plan.savings.map((s) => (s.id === "sav-car" ? { ...s, active: false } : s));
    const res = calculate(plan);
    const p = projectSavings(plan, res, 1);
    expect(p.accounts[0].monthly).toBe(150);
    // travel + home buckets are unlinked, plus the surplus
    expect(p.unassigned).toBeCloseTo(120 + 80 + res.surplus, 6);
  });

  it("routes the surplus to the chosen account", () => {
    const plan = withAccounts();
    plan.settings.surplusAccountId = "acc-tg";
    const res = calculate(plan);
    const p = projectSavings(plan, res, 1);
    expect(res.surplus).toBeGreaterThan(0);
    expect(p.accounts[0].receivesSurplus).toBe(true);
    expect(p.accounts[0].monthly).toBeCloseTo(250 + res.surplus, 6);
    expect(p.unassigned).toBeCloseTo(200, 6);
  });

  it("ignores links to accounts that no longer exist", () => {
    const plan = withAccounts();
    plan.accounts = plan.accounts.slice(0, 1);
    const p = projectSavings(plan, calculate(plan), 1);
    expect(p.accounts).toHaveLength(1);
    expect(p.unassigned).toBeGreaterThanOrEqual(250);
  });
});
