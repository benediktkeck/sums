import { describe, expect, it } from "vitest";
import { referencePlan } from "../fixtures/reference-plan";
import {
  nextExpenseSort,
  sortExpenses,
  type ExpenseSort,
  conditionedItems,
  describeEffect,
  effectToText,
  moveById,
  removeAccount,
  removeCar,
  removeCategory,
  removeItem,
  removePerson,
  removeSwitch,
} from "./ops";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("describeEffect", () => {
  const plan = referencePlan();
  const [setA, enable, , officeDays] = plan.switches[0].effects;

  it("describes set effects with the previous value", () => {
    const d = describeEffect(plan, setA);
    expect(nbsp(`${d.pre} ${d.value} ${d.post}`)).toBe("Einkommen Person A auf 0,00 € setzen");
    expect(nbsp(d.sub)).toBe("statt 3.100,00 €");
  });

  it("describes enable effects with the item amount", () => {
    expect(nbsp(effectToText(plan, enable))).toBe("Elterngeld 1.500,00 € einschalten");
  });

  it("describes person fields", () => {
    const d = describeEffect(plan, officeDays);
    expect(`${d.pre} ${d.value}`).toBe("Bürotage Person A auf 0");
    expect(d.sub).toContain("Tankkosten");
  });

  it("flags effects whose target was deleted", () => {
    const p = referencePlan();
    removeItem(p, "income", "inc-parental");
    expect(p.switches[0].effects).toHaveLength(3);
    const dangling = { id: "x", type: "enable" as const, entity: "income" as const, targetId: "gone" };
    expect(describeEffect(p, dangling).broken).toBe(true);
  });
});

describe("removals keep references consistent", () => {
  it("removing a switch clears conditions", () => {
    const p = referencePlan();
    expect(conditionedItems(p, "sw-car")).toHaveLength(3);
    removeSwitch(p, "sw-car");
    expect(conditionedItems(p, "sw-car")).toHaveLength(0);
    expect(p.expenses.every((e) => e.condition == null)).toBe(true);
  });

  it("removing a person unlinks incomes and drops fuel lines and effects", () => {
    const p = referencePlan();
    removePerson(p, "p-a");
    expect(p.incomes.find((i) => i.id === "inc-a")?.personId).toBeNull();
    expect(p.variableCosts.some((v) => v.id === "var-fuel-a")).toBe(false);
    expect(p.switches[0].effects.some((e) => e.type === "set" && e.target.entity === "person")).toBe(false);
  });

  it("removing a car leaves its drivers without one and drops effects", () => {
    const p = referencePlan();
    p.persons[1].carId = "car-p-a";
    p.switches[0].effects.push({ id: "x", type: "set", target: { entity: "car", id: "car-p-a", field: "consumption" }, value: 5 });
    removeCar(p, "car-p-a");
    expect(p.cars.map((c) => c.id)).toEqual(["car-p-b"]);
    expect(p.persons.map((x) => x.carId)).toEqual([null, null]);
    expect(p.switches[0].effects.some((e) => e.type === "set" && e.target.entity === "car")).toBe(false);
  });

  it("removing a category uncategorizes or moves expenses", () => {
    const p = referencePlan();
    removeCategory(p, "cat-sub", "cat-home");
    expect(p.expenses.filter((e) => e.categoryId === "cat-sub")).toHaveLength(0);
    expect(p.expenses.find((e) => e.name === "Musikstreaming")?.categoryId).toBe("cat-home");
  });

  it("removing a savings account unlinks buckets and the surplus", () => {
    const p = referencePlan();
    p.accounts = [{ id: "acc-1", name: "Tagesgeld", kind: "account", color: "var(--acc-1)", balance: 0, rate: 2 }];
    p.savings[0].accountId = "acc-1";
    p.settings.surplusAccountId = "acc-1";
    removeAccount(p, "acc-1");
    expect(p.accounts).toHaveLength(0);
    expect(p.savings.every((s) => s.accountId === null)).toBe(true);
    expect(p.settings.surplusAccountId).toBeNull();
  });
});

describe("moveById", () => {
  const arr = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves before another item or to the end", () => {
    expect(moveById(arr, "c", "a").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(moveById(arr, "a", null).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(moveById(arr, "a", "c").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(moveById(arr, "a", "c", true).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(moveById(arr, "c", "a", true).map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
});

describe("expense sorting", () => {
  const row = (id: string, name: string, provider: string, interval: "monthly" | "yearly", amount: number) => ({ id, name, provider, interval, amount });
  const items = [row("a", "Zahnzusatz", "", "yearly", 120), row("b", "Äpfel", "Markt", "monthly", 30), row("c", "Miete", "Vermieter", "monthly", 900)];
  const ids = (sort: ExpenseSort | null) => sortExpenses(items, sort, (e) => e.amount / (e.interval === "yearly" ? 12 : 1)).map((e) => e.id);

  it("keeps the manual order without a sort", () => {
    expect(ids(null)).toEqual(["a", "b", "c"]);
  });

  it("sorts text with German collation and numbers by value", () => {
    expect(ids({ key: "name", dir: "asc" })).toEqual(["b", "c", "a"]);
    expect(ids({ key: "monthly", dir: "desc" })).toEqual(["c", "b", "a"]);
    expect(ids({ key: "amount", dir: "asc" })).toEqual(["b", "a", "c"]);
  });

  it("keeps rows without a provider last in both directions", () => {
    expect(ids({ key: "provider", dir: "asc" })).toEqual(["b", "c", "a"]);
    expect(ids({ key: "provider", dir: "desc" })).toEqual(["c", "b", "a"]);
  });

  it("cycles a column through both directions and back to manual", () => {
    expect(nextExpenseSort(null, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextExpenseSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextExpenseSort({ key: "name", dir: "desc" }, "name")).toBeNull();
    expect(nextExpenseSort({ key: "name", dir: "asc" }, "monthly")).toEqual({ key: "monthly", dir: "desc" });
  });
});
