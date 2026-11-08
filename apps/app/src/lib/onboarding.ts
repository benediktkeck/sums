import type { Expense, Income, Plan } from "@sums/core/model/schema";

/**
 * First-run guidance: the setup steps a new plan walks through and the
 * examples offered on empty pages. Pure; the UI keeps skip/dismiss flags in
 * browser storage (see `components/onboarding/guide-store.ts`).
 */

/** Persons aren't a step: the start screen asks for the names before anything else. */
export type StepId = "income" | "fixed" | "variable" | "savings";

export type SetupStep = {
  id: StepId;
  label: string;
  href: string;
  /** One line on the start checklist: what belongs into this step. */
  hint: string;
};

export const SETUP_STEPS: readonly SetupStep[] = [
  { id: "income", label: "Einkommen", href: "/einkommen", hint: "Was netto reinkommt, pro Monat" },
  { id: "fixed", label: "Fixkosten", href: "/fixkosten", hint: "Miete, Versicherungen, Verträge, Abos" },
  { id: "variable", label: "Variable Kosten", href: "/variable", hint: "Lebensmittel, Freizeit und anderes, das schwankt" },
  { id: "savings", label: "Rücklagen", href: "/ruecklagen", hint: "Was du bewusst zur Seite legst" },
];

export type StepProgress = SetupStep & { count: number; skipped: boolean; done: boolean };

export type SetupProgress = {
  steps: StepProgress[];
  doneCount: number;
  complete: boolean;
  /** First step that is neither filled nor skipped. */
  next: StepProgress | undefined;
};

export function stepCount(plan: Plan, id: StepId): number {
  switch (id) {
    case "income":
      return plan.incomes.length;
    case "fixed":
      return plan.expenses.length;
    case "variable":
      return plan.variableCosts.length;
    case "savings":
      return plan.savings.length;
  }
}

/** A step is done once it has an entry or was skipped. */
export function setupProgress(plan: Plan, skipped: readonly string[]): SetupProgress {
  const steps = SETUP_STEPS.map((s) => {
    const count = stepCount(plan, s.id);
    const isSkipped = count === 0 && skipped.includes(s.id);
    return { ...s, count, skipped: isSkipped, done: count > 0 || isSkipped };
  });
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, complete: doneCount === steps.length, next: steps.find((s) => !s.done) };
}

/** The step a page belongs to, by path. */
export function stepForPath(pathname: string): SetupStep | undefined {
  return SETUP_STEPS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
}

/** Where "Weiter" leads from a step: the next open step after it, else the first open one, else the overview. */
export function nextHref(progress: SetupProgress, from: StepId): { href: string; label: string } {
  const i = progress.steps.findIndex((s) => s.id === from);
  const after = progress.steps.slice(i + 1).find((s) => !s.done) ?? progress.steps.find((s) => !s.done && s.id !== from);
  return after ? { href: after.href, label: after.label } : { href: "/uebersicht", label: "Übersicht" };
}

// ---------------------------------------------------------------------------
// Examples for empty pages: one click opens the dialog with the name filled in.

export type ExpensePreset = { name: string; categoryId: string; interval: Expense["interval"] };
export type NamedPreset = { name: string; personId?: string | null };

/** Category ids are those of `emptyPlan()`; presets whose category was deleted fall back to the first one. */
export const EXPENSE_PRESETS: readonly ExpensePreset[] = [
  { name: "Miete", categoryId: "cat-home", interval: "monthly" },
  { name: "Strom", categoryId: "cat-home", interval: "monthly" },
  { name: "Internet", categoryId: "cat-home", interval: "monthly" },
  { name: "Handy", categoryId: "cat-sub", interval: "monthly" },
  { name: "Streaming", categoryId: "cat-sub", interval: "monthly" },
  { name: "Rundfunkbeitrag", categoryId: "cat-home", interval: "quarterly" },
  { name: "Haftpflicht", categoryId: "cat-ins", interval: "yearly" },
  { name: "Hausrat", categoryId: "cat-ins", interval: "yearly" },
  { name: "Kfz-Versicherung", categoryId: "cat-car", interval: "yearly" },
];

export function expensePresets(plan: Plan): (ExpensePreset & { categoryId: string | null })[] {
  const known = new Set(plan.categories.map((c) => c.id));
  const taken = new Set(plan.expenses.map((e) => e.name.toLowerCase()));
  return EXPENSE_PRESETS.filter((p) => !taken.has(p.name.toLowerCase())).map((p) => ({
    ...p,
    categoryId: known.has(p.categoryId) ? p.categoryId : (plan.categories[0]?.id ?? null),
  }));
}

/** One salary per person, then common extras. */
export function incomePresets(plan: Plan): (NamedPreset & Pick<Income, "personId">)[] {
  const salaries = plan.persons.map((p) => ({ name: plan.persons.length > 1 ? `Gehalt ${p.name}` : "Gehalt", personId: p.id }));
  const extras = ["Kindergeld", "Nebenjob", "Mieteinnahmen"].map((name) => ({ name, personId: null }));
  const taken = new Set(plan.incomes.map((i) => i.label.toLowerCase()));
  return [...salaries, ...extras].filter((p) => !taken.has(p.name.toLowerCase()));
}

export function variablePresets(plan: Plan): NamedPreset[] {
  const taken = new Set(plan.variableCosts.map((v) => v.label.toLowerCase()));
  const names = ["Lebensmittel", "Drogerie", "Freizeit", "Kleidung", ...(plan.settings.commute ? [] : ["Tanken"]), "Geschenke"];
  return names.filter((n) => !taken.has(n.toLowerCase())).map((name) => ({ name }));
}

export function savingsPresets(plan: Plan): NamedPreset[] {
  const taken = new Set(plan.savings.map((s) => s.name.toLowerCase()));
  return ["Notgroschen", "Urlaub", "Anschaffungen", "Auto", "Altersvorsorge"].filter((n) => !taken.has(n.toLowerCase())).map((name) => ({ name }));
}
