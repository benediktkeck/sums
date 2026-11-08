import { describe, expect, it } from "vitest";
import { referencePlan } from "@sums/core/fixtures/reference-plan";
import { LocalBackend, memoryPersistence } from "./local";

describe("LocalBackend", () => {
  it("seeds an empty plan and persists every version", async () => {
    const store = memoryPersistence();
    const b = await LocalBackend.open(store);
    const s0 = await b.getState();
    expect(s0.plan.expenses).toEqual([]);
    const s1 = await b.replace(referencePlan(), "Beispiel");
    expect(s1.canUndo).toBe(true);
    expect(store.data.versions.map((v) => v.id)).toEqual([1, 2]);
    expect(store.data.head).toBe(2);

    // A second "tab" opened on the same storage sees the same state.
    const other = await LocalBackend.open(store);
    expect((await other.getState()).head.id).toBe(2);
  });

  it("supports undo, redo, labels and restore like the server", async () => {
    const b = await LocalBackend.open(memoryPersistence());
    const s0 = await b.getState();
    const s1 = await b.replace(referencePlan(), "Beispiel");
    expect((await b.undo()).head.id).toBe(s0.head.id);
    expect((await b.redo()).head.id).toBe(s1.head.id);
    await b.setLabel(s1.head.id, "Start");
    expect((await b.history({ labeledOnly: true })).map((h) => h.label)).toEqual(["Start"]);
    const r = await b.restore(s0.head.id);
    expect(r.head.parentId).toBe(s1.head.id);
    expect(r.plan.expenses).toEqual([]);
  });

  it("rejects stale commits with status 409", async () => {
    const b = await LocalBackend.open(memoryPersistence());
    const s0 = await b.getState();
    await b.commit({ baseId: s0.head.id, data: referencePlan(), summary: "a" });
    await expect(b.commit({ baseId: s0.head.id, data: referencePlan(), summary: "b" })).rejects.toMatchObject({ status: 409 });
  });

  it("reloads from storage after another tab wrote", async () => {
    const store = memoryPersistence();
    let notify = () => {};
    const shared = { ...store, listen: (fn: () => void) => void (notify = fn) };
    const a = await LocalBackend.open(shared);
    const b = await LocalBackend.open(store);
    const s0 = await a.getState();
    await b.commit({ baseId: s0.head.id, data: referencePlan(), summary: "anderer Tab" });
    notify();
    expect((await a.getState()).head.summary).toBe("anderer Tab");
  });

  it("keeps memory and storage in sync when saving fails", async () => {
    const store = memoryPersistence();
    let fail = true;
    const flaky = { ...store, save: async (c: Parameters<typeof store.save>[0]) => (fail ? Promise.reject(new Error("voll")) : store.save(c)) };
    const b = await LocalBackend.open(flaky);
    await expect(b.getState()).rejects.toThrow("voll"); // seeding the first version fails
    fail = false;
    const s = await b.getState();
    expect(s.head.id).toBe(1);
    expect(store.data.versions).toHaveLength(1);
  });
});
