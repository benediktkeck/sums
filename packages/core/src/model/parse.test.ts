import { describe, expect, it } from "vitest";
import { referencePlan } from "../fixtures/reference-plan";
import { calculate } from "../engine/calculate";
import { emptyPlan } from "./empty";
import { parsePlan } from "./parse";
import { SCHEMA_VERSION } from "./schema";

/** The reference plan as it was stored before cars were split off persons. */
function v2Doc() {
  const doc = JSON.parse(JSON.stringify(referencePlan()));
  doc.schemaVersion = 2;
  doc.persons = doc.persons.map(({ carId, ...p }: { carId: string }) => {
    const car = doc.cars.find((c: { id: string }) => c.id === carId);
    return { ...p, consumption: car.consumption, fuelType: car.fuelType };
  });
  delete doc.cars;
  return doc;
}

describe("parsePlan", () => {
  it("accepts valid plans", () => {
    expect(parsePlan(JSON.parse(JSON.stringify(referencePlan())))).toEqual(referencePlan());
    expect(() => parsePlan(emptyPlan())).not.toThrow();
  });
  it("rejects invalid documents", () => {
    expect(() => parsePlan({ ...referencePlan(), schemaVersion: 99 })).toThrow(/Schema-Version/);
    const bad = referencePlan() as unknown as { expenses: { interval: string }[] };
    bad.expenses[0].interval = "weekly";
    expect(() => parsePlan(bad)).toThrow();
  });
  it("migrates v1 documents (no savings accounts yet)", () => {
    const v1 = v2Doc();
    v1.schemaVersion = 1;
    delete v1.accounts;
    delete v1.settings.surplusAccountId;
    for (const s of v1.savings) delete s.accountId;
    const plan = parsePlan(v1);
    expect(plan).toEqual(referencePlan());
  });
  it("migrates v4 documents: equal split, commute module on only when it is used", () => {
    const v4 = JSON.parse(JSON.stringify(referencePlan()));
    v4.schemaVersion = 4;
    delete v4.settings.splitMode;
    delete v4.settings.commute;
    expect(parsePlan(v4)).toEqual(referencePlan());

    const blank = JSON.parse(JSON.stringify(emptyPlan()));
    blank.schemaVersion = 4;
    delete blank.settings.splitMode;
    delete blank.settings.commute;
    expect(parsePlan(blank).settings).toMatchObject({ splitMode: "equal", commute: false });
  });
  it("migrates v3 documents: existing savings accounts stay plain accounts", () => {
    const v3 = v2Doc();
    v3.schemaVersion = 3;
    v3.cars = [];
    for (const p of v3.persons) {
      p.carId = null;
      delete p.consumption;
      delete p.fuelType;
    }
    v3.accounts = [{ id: "acc-1", name: "Tagesgeld", color: "var(--acc-1)", balance: 100, rate: 2 }];
    expect(parsePlan(v3).accounts).toEqual([{ id: "acc-1", name: "Tagesgeld", kind: "account", color: "var(--acc-1)", balance: 100, rate: 2 }]);
  });
  it("migrates v2 documents: every person keeps their car and all amounts stay the same", () => {
    const v2 = v2Doc();
    v2.persons[1].fuelType = "diesel";
    v2.switches[0].effects.push({ id: "c", type: "set", target: { entity: "person", id: "p-b", field: "consumption" }, value: 4 });
    v2.switches[0].effects.push({ id: "o", type: "set", target: { entity: "person", id: "p-b", field: "commuteKm" }, value: 9 });
    const plan = parsePlan(v2);
    expect(plan.schemaVersion).toBe(SCHEMA_VERSION);
    expect(plan.persons[1]).toEqual({ id: "p-b", name: "Person B", color: "#3f9c8a", officeDaysPerWeek: 2, commuteKm: 25, carId: "car-p-b" });
    expect(plan.cars[1]).toEqual({ id: "car-p-b", name: "Auto Person B", consumption: 5, fuelType: "diesel" });
    const effects = plan.switches[0].effects;
    expect(effects.at(-2)).toMatchObject({ target: { entity: "car", id: "car-p-b", field: "consumption" }, value: 4 });
    expect(effects.at(-1)).toMatchObject({ target: { entity: "person", id: "p-b", field: "commuteKm" }, value: 9 });

    const same = referencePlan();
    same.cars[1].fuelType = "diesel";
    same.switches[0].effects.push(...effects.slice(-2));
    expect(calculate(plan).free).toBe(calculate(same).free);
    expect(calculate(plan).variable.items).toEqual(calculate(same).variable.items);
  });
});
