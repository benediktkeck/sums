import { describe, expect, it } from "vitest";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { emptyPlan } from "@sums/core/model/empty";
import { addPerson } from "@sums/core/model/ops";
import { expensePresets, incomePresets, nextHref, setupProgress, stepForPath } from "./onboarding";

function started() {
  const plan = emptyPlan();
  addPerson(plan, "Kim");
  return plan;
}

describe("setup progress", () => {
  it("a fresh plan with one person starts at income", () => {
    const p = setupProgress(started(), []);
    expect(p.doneCount).toBe(0);
    expect(p.next?.id).toBe("income");
    expect(p.complete).toBe(false);
  });

  it("skipped steps count as done until something is entered", () => {
    const plan = started();
    const p = setupProgress(plan, ["income", "fixed", "variable", "savings"]);
    expect(p.complete).toBe(true);
    plan.incomes.push({ id: "i", label: "Gehalt", personId: null, amount: 1, active: true, condition: null });
    expect(setupProgress(plan, ["income"]).steps.find((s) => s.id === "income")).toMatchObject({ done: true, skipped: false, count: 1 });
  });

  it("the demo plan is complete", () => {
    expect(setupProgress(demoPlan(), []).complete).toBe(true);
  });

  it("'Weiter' goes to the next open step, wrapping to earlier ones, then the overview", () => {
    const plan = started();
    expect(nextHref(setupProgress(plan, []), "income").href).toBe("/fixkosten");
    expect(nextHref(setupProgress(plan, ["fixed", "variable", "savings"]), "savings").href).toBe("/einkommen");
    expect(nextHref(setupProgress(plan, ["income", "fixed", "variable", "savings"]), "savings").href).toBe("/uebersicht");
  });

  it("maps pages to steps", () => {
    expect(stepForPath("/fixkosten")?.id).toBe("fixed");
    expect(stepForPath("/einstellungen/personen")).toBeUndefined();
    expect(stepForPath("/einstellungen")).toBeUndefined();
  });
});

describe("presets", () => {
  it("offers one salary per person and hides names already used", () => {
    const plan = started();
    addPerson(plan, "Sam");
    expect(incomePresets(plan).slice(0, 2).map((p) => p.name)).toEqual(["Gehalt Kim", "Gehalt Sam"]);
    plan.incomes.push({ id: "i", label: "Gehalt Kim", personId: null, amount: 1, active: true, condition: null });
    expect(incomePresets(plan)[0].name).toBe("Gehalt Sam");
  });

  it("falls back to an existing category", () => {
    const plan = started();
    plan.categories = [{ id: "own", name: "Alles", color: "red" }];
    expect(new Set(expensePresets(plan).map((p) => p.categoryId))).toEqual(new Set(["own"]));
  });
});
