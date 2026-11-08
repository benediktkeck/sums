import { describe, expect, it } from "vitest";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { emptyPlan } from "@sums/core/model/empty";
import { addPerson } from "@sums/core/model/ops";
import type { Plan } from "@sums/core/model/schema";
import { planChangeEvents, planProperties } from "./events";

function change(before: Plan, mutate: (d: Plan) => void, skipped: string[] = []) {
  const after = structuredClone(before);
  mutate(after);
  return planChangeEvents(before, after, skipped);
}

const income = (id: string, amount = 1000) => ({ id, label: "Gehalt", personId: null, amount, active: true, condition: null });
const expense = (id: string) => ({ id, name: "Miete", provider: "", amount: 900, interval: "yearly" as const, categoryId: null, active: true, condition: null, notes: "" });

describe("planChangeEvents", () => {
  it("reports created items with their kind, never their content", () => {
    const events = change(emptyPlan(), (d) => d.expenses.push(expense("e1")));
    expect(events).toContainEqual({ event: "item_created", props: { type: "expense", interval: "yearly" } });
  });

  it("reports deletes, toggles, reorders and single-field edits", () => {
    const base = change(emptyPlan(), () => {});
    expect(base).toEqual([]);
    const plan = emptyPlan();
    plan.incomes.push(income("a"), income("b"));

    expect(change(plan, (d) => d.incomes.pop())).toEqual([{ event: "item_deleted", props: { type: "income" } }]);
    expect(change(plan, (d) => (d.incomes[0].active = false))).toEqual([{ event: "item_toggled", props: { type: "income", active: false } }]);
    expect(change(plan, (d) => d.incomes.reverse())).toEqual([{ event: "items_reordered", props: { type: "income" } }]);
    expect(change(plan, (d) => (d.incomes[0].amount = 2000))).toEqual([{ event: "item_edited", props: { type: "income", field: "amount" } }]);
    expect(change(plan, (d) => Object.assign(d.incomes[0], { amount: 1, label: "x" }))).toEqual([
      { event: "item_edited", props: { type: "income", field: "multiple" } },
    ]);
  });

  it("reports scenario switches and new conditions", () => {
    const plan = demoPlan();
    const sw = plan.switches[0];
    expect(change(plan, (d) => (d.switches[0].on = !sw.on))).toEqual([{ event: "scenario_toggled", props: { on: !sw.on, effect_count: sw.effects.length } }]);
    const target = plan.expenses.find((e) => !e.condition)!;
    const events = change(plan, (d) => (d.expenses.find((e) => e.id === target.id)!.condition = { switchId: sw.id, when: "on" }));
    expect(events).toContainEqual({ event: "condition_set", props: { type: "expense" } });
  });

  it("reports enum settings with their value and amounts only by name", () => {
    const plan = emptyPlan();
    expect(change(plan, (d) => (d.settings.splitMode = "income"))).toEqual([{ event: "setting_changed", props: { setting: "splitMode", value: "income" } }]);
    expect(change(plan, (d) => (d.settings.allowanceCap = 123))).toEqual([{ event: "setting_changed", props: { setting: "allowanceCap" } }]);
  });

  it("marks setup milestones: first entry per step, setup complete, plan activated", () => {
    const plan = emptyPlan();
    addPerson(plan, "Person A");
    const first = change(plan, (d) => d.incomes.push(income("i1")));
    expect(first).toContainEqual({ event: "setup_step_completed", props: { step: "income", method: "entry" } });
    expect(first.map((e) => e.event)).not.toContain("plan_activated");

    const withIncome = structuredClone(plan);
    withIncome.incomes.push(income("i1"));
    const second = change(withIncome, (d) => d.expenses.push(expense("e1")), ["variable", "savings"]);
    expect(second.map((e) => e.event)).toEqual(expect.arrayContaining(["setup_step_completed", "setup_completed", "plan_activated"]));
    // A second entry in the same step is no milestone.
    const after = structuredClone(withIncome);
    after.expenses.push(expense("e1"));
    expect(change(after, (d) => d.expenses.push(expense("e2"))).map((e) => e.event)).toEqual(["item_created"]);
  });

  it("never carries names, labels or amounts", () => {
    const plan = demoPlan();
    const secrets = ["Geheimname", "Privatnotiz", "Spezialanbieter", "98765"];
    const events = [
      ...change(plan, (d) => {
        addPerson(d, "Geheimname");
        d.expenses.push({ ...expense("x"), name: "Geheimname", provider: "Spezialanbieter", notes: "Privatnotiz", amount: 98765 });
        d.incomes[0].label = "Geheimname";
        d.incomes[0].amount = 98765;
        d.settings.allowanceCap = 98765;
        d.switches[0].name = "Geheimname";
      }),
    ];
    const json = JSON.stringify(events) + JSON.stringify(planProperties(plan));
    for (const s of secrets) expect(json).not.toContain(s);
  });
});
