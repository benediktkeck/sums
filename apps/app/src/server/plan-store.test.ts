import { beforeEach, describe, expect, it } from "vitest";
import { referencePlan } from "@sums/core/fixtures/reference-plan";
import type { Plan } from "@sums/core/model/schema";
import { openDb } from "./db/client";
import { COALESCE_WINDOW_MS, ConflictError, PlanStore } from "./plan-store";

function setAmount(plan: Plan, id: string, amount: number): Plan {
  return { ...plan, expenses: plan.expenses.map((e) => (e.id === id ? { ...e, amount } : e)) };
}

describe("PlanStore", () => {
  let now = 1_000_000;
  let store: PlanStore;

  beforeEach(() => {
    now = 1_000_000;
    store = new PlanStore(openDb(":memory:"), () => now);
  });

  it("seeds an empty plan on first access", () => {
    const s = store.getState();
    expect(s.head.id).toBe(1);
    expect(s.plan.expenses).toEqual([]);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it("stores each commit as a new version and supports undo/redo", () => {
    const s0 = store.getState();
    const s1 = store.replace(referencePlan(), "Import");
    const s2 = store.commit({ baseId: s1.head.id, data: setAmount(s1.plan, "exp-4", 55), summary: "Internet" });
    expect(s2.head.id).toBe(3);
    expect(s2.head.parentId).toBe(s1.head.id);
    expect(s2.canUndo).toBe(true);

    const u1 = store.undo();
    expect(u1.head.id).toBe(s1.head.id);
    expect(u1.plan.expenses[3].amount).toBe(40);
    expect(u1.canRedo).toBe(true);

    const u2 = store.undo();
    expect(u2.head.id).toBe(s0.head.id);
    expect(store.undo().head.id).toBe(s0.head.id); // nothing further

    expect(store.redo().head.id).toBe(s1.head.id);
    expect(store.redo().plan.expenses[3].amount).toBe(55);
    expect(store.getState().canRedo).toBe(false);
  });

  it("redo follows the newest branch after editing an undone state", () => {
    const s1 = store.replace(referencePlan(), "Import");
    store.commit({ baseId: s1.head.id, data: setAmount(s1.plan, "exp-4", 55) });
    const back = store.undo();
    const branch = store.commit({ baseId: back.head.id, data: setAmount(back.plan, "exp-4", 60) });
    expect(store.undo().head.id).toBe(s1.head.id);
    expect(store.redo().head.id).toBe(branch.head.id);
    // The abandoned branch is still in the history.
    expect(store.history().map((h) => h.id)).toContain(3);
  });

  it("coalesces rapid edits with the same key", () => {
    const s1 = store.replace(referencePlan(), "Import");
    const a = store.commit({ baseId: s1.head.id, data: setAmount(s1.plan, "exp-4", 5), coalesceKey: "exp-4:amount", summary: "40 → 5" });
    now += 1000;
    const b = store.commit({ baseId: a.head.id, data: setAmount(s1.plan, "exp-4", 55), coalesceKey: "exp-4:amount", summary: "40 → 55" });
    expect(b.head.id).toBe(a.head.id);
    expect(b.head.summary).toBe("40 → 55");
    expect(b.plan.expenses[3].amount).toBe(55);

    // A different key starts a new version.
    const c = store.commit({ baseId: b.head.id, data: setAmount(b.plan, "exp-3", 160), coalesceKey: "exp-3:amount" });
    expect(c.head.id).toBe(b.head.id + 1);

    // The same key after the window starts a new version too.
    now += COALESCE_WINDOW_MS + 1;
    const d = store.commit({ baseId: c.head.id, data: setAmount(c.plan, "exp-3", 170), coalesceKey: "exp-3:amount" });
    expect(d.head.id).toBe(c.head.id + 1);
  });

  it("never coalesces into a named save state", () => {
    const s1 = store.replace(referencePlan(), "Import");
    const a = store.commit({ baseId: s1.head.id, data: setAmount(s1.plan, "exp-4", 5), coalesceKey: "k" });
    store.setLabel(a.head.id, "Vor dem Umzug");
    const b = store.commit({ baseId: a.head.id, data: setAmount(s1.plan, "exp-4", 55), coalesceKey: "k" });
    expect(b.head.id).not.toBe(a.head.id);
    expect(store.getVersion(a.head.id).plan.expenses[3].amount).toBe(5);
  });

  it("rejects commits based on a stale head", () => {
    const s1 = store.replace(referencePlan(), "Import");
    store.commit({ baseId: s1.head.id, data: s1.plan });
    expect(() => store.commit({ baseId: s1.head.id, data: s1.plan })).toThrow(ConflictError);
  });

  it("rejects invalid plan data", () => {
    const s = store.getState();
    expect(() => store.commit({ baseId: s.head.id, data: { nope: true } })).toThrow();
    expect(store.getState().head.id).toBe(s.head.id);
  });

  it("restores an old version as a new version", () => {
    const s1 = store.replace(referencePlan(), "Import");
    store.setLabel(s1.head.id, "Ausgangslage");
    const s2 = store.commit({ baseId: s1.head.id, data: setAmount(s1.plan, "exp-1", 2000) });
    const r = store.restore(s1.head.id);
    expect(r.head.id).toBe(s2.head.id + 1);
    expect(r.head.parentId).toBe(s2.head.id);
    expect(r.head.summary).toContain("Ausgangslage");
    expect(r.plan.expenses[0].amount).toBe(1200);
    expect(store.undo().plan.expenses[0].amount).toBe(2000);
  });

  it("lists history newest first with labels and free amounts", () => {
    const s1 = store.replace(referencePlan(), "Import");
    store.setLabel(s1.head.id, "Ausgangslage");
    const h = store.history();
    expect(h[0]).toMatchObject({ id: s1.head.id, isHead: true, label: "Ausgangslage" });
    expect(Math.round(h[0].free! * 100) / 100).toBe(2495.84);
    expect(store.history({ labeledOnly: true })).toHaveLength(1);
    store.setLabel(s1.head.id, "  ");
    expect(store.history({ labeledOnly: true })).toHaveLength(0);
  });
});
