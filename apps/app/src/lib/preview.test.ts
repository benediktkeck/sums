import { describe, expect, it } from "vitest";
import { calculate } from "@sums/core/engine/calculate";
import { referencePlan } from "@sums/core/fixtures/reference-plan";
import type { Plan } from "@sums/core/model/schema";
import { PREVIEW_PAGES, previewPage, signedEur } from "./preview";

const docOf = (plan: Plan, href: string) => previewPage(href)!.build(plan, calculate(plan));
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 2);

describe("preview documents", () => {
  it.each(PREVIEW_PAGES.map((p) => p.href).filter((h) => h !== "/uebersicht"))("%s: rows add up to the closing total", (href) => {
    const doc = docOf(referencePlan(), href);
    const rows = doc.sections.flatMap((s) => s.rows).reduce((s, r) => s + r.value, 0);
    close(rows, doc.footer[doc.footer.length - 1].value);
  });

  it("section totals add up to their rows", () => {
    for (const s of docOf(referencePlan(), "/fixkosten").sections) {
      close(s.total!, s.rows.reduce((sum, r) => sum + r.value, 0));
    }
  });

  it("leaves out switched-off items and counts them", () => {
    const plan = referencePlan();
    const before = docOf(plan, "/fixkosten");
    const result = calculate(plan);
    const target = plan.expenses.find((e) => result.expenses[e.id].status.active && !result.expenses[e.id].status.reason)!;
    target.active = false;
    const after = docOf(plan, "/fixkosten");
    expect(after.sections.flatMap((s) => s.rows).some((r) => r.id === target.id)).toBe(false);
    expect(after.hidden).toBe(before.hidden + 1);
  });

  it("marks periodic payments as reserve and shows their real amount", () => {
    const rows = docOf(referencePlan(), "/fixkosten").sections.flatMap((s) => s.rows);
    const periodic = rows.filter((r) => r.reserve);
    expect(periodic.length).toBeGreaterThan(0);
    for (const r of periodic) expect(r.detail).toMatch(/€/);
    for (const r of rows.filter((x) => !x.reserve)) expect(r.detail).toBeUndefined();
  });

  it("overview follows the sidebar order and matches its calculation", () => {
    const plan = referencePlan();
    const result = calculate(plan);
    const doc = docOf(plan, "/uebersicht");
    const rows = doc.sections[0].rows;
    expect(rows.map((r) => r.name)).toEqual(["Einkommen", "Fixkosten", "Variable Kosten", "Rücklagen", "Frei verfügbar", "Taschengeld"]);
    close(rows[4].value, result.free);
    close(rows[5].value, result.allowance.total);
    close(doc.footer[0].value, result.surplus);
    expect(doc.after!.sections[0].rows).toHaveLength(plan.persons.length);
    close(doc.after!.footer[0].value, result.surplus);
  });

  it("overview shows a shortfall without allowance", () => {
    const plan = referencePlan();
    plan.expenses[0].amount = 100000;
    plan.expenses[0].active = true;
    plan.expenses[0].interval = "monthly";
    plan.expenses[0].condition = null;
    const doc = docOf(plan, "/uebersicht");
    expect(doc.total).toBeLessThan(0);
    expect(doc.sections[0].rows).toHaveLength(4);
    expect(doc.footer[0].label).toBe("Frei verfügbar");
    expect(doc.after!.footer[0].label).toBe("Fehlbetrag");
    expect(signedEur(doc.total).startsWith("−")).toBe(true);
  });

  it("only exact table routes have a preview", () => {
    expect(previewPage("/fixkosten")?.label).toBe("Fixkosten");
    expect(previewPage("/fixkosten/x")).toBeUndefined();
    expect(previewPage("/einstellungen/personen")).toBeUndefined();
  });
});
