import { formatEur, formatNumber } from "../format";
import type { Effect, Interval, Plan, SetTarget, ToggleEntity } from "./schema";
import { PERSON_COLORS } from "./empty";

/** Plan helpers shared by the UI and the importer. Pure functions. */

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export const INTERVAL_LABEL: Record<Interval, string> = {
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  "half-yearly": "Halbjährlich",
  yearly: "Jährlich",
};
export const INTERVALS: Interval[] = ["monthly", "quarterly", "half-yearly", "yearly"];

export const ENTITY_LABEL: Record<ToggleEntity | "person" | "car" | "settings", string> = {
  income: "Einkommen",
  expense: "Fixkosten",
  variable: "Variable Kosten",
  savings: "Rücklagen",
  person: "Person",
  car: "Auto",
  settings: "Einstellungen",
};

export const PERSON_FIELD_LABEL = {
  officeDaysPerWeek: "Bürotage",
  commuteKm: "Arbeitsweg (km)",
} as const;

export const SETTINGS_FIELD_LABEL = {
  allowanceCap: "Taschengeld-Obergrenze",
  fuelPriceE10: "Preis E10",
  fuelPriceDiesel: "Preis Diesel",
  weeksPerMonth: "Wochen pro Monat",
} as const;

export function itemName(plan: Plan, entity: ToggleEntity | "person" | "car", id: string): string | null {
  switch (entity) {
    case "income":
      return plan.incomes.find((i) => i.id === id)?.label ?? null;
    case "expense":
      return plan.expenses.find((i) => i.id === id)?.name ?? null;
    case "variable":
      return plan.variableCosts.find((i) => i.id === id)?.label ?? null;
    case "savings":
      return plan.savings.find((i) => i.id === id)?.name ?? null;
    case "person":
      return plan.persons.find((i) => i.id === id)?.name ?? null;
    case "car":
      return plan.cars.find((i) => i.id === id)?.name ?? null;
  }
}

function isMoneyTarget(t: SetTarget): boolean {
  if (t.entity === "person" || t.entity === "car") return false;
  if (t.entity === "settings") return t.field !== "weeksPerMonth";
  return true;
}

export function formatTargetValue(t: SetTarget, v: number): string {
  if (t.entity === "settings" && (t.field === "fuelPriceE10" || t.field === "fuelPriceDiesel")) {
    return `${formatNumber(v, 3)} €/l`;
  }
  return isMoneyTarget(t) ? formatEur(v) : formatNumber(v);
}

/** Current (unmodified) value a set-effect would replace. */
export function baseValue(plan: Plan, t: SetTarget): number | null {
  if (t.entity === "settings") return plan.settings[t.field];
  if (t.entity === "person") return plan.persons.find((p) => p.id === t.id)?.[t.field] ?? null;
  if (t.entity === "car") return plan.cars.find((c) => c.id === t.id)?.[t.field] ?? null;
  const item =
    t.entity === "income"
      ? plan.incomes.find((i) => i.id === t.id)
      : t.entity === "expense"
        ? plan.expenses.find((i) => i.id === t.id)
        : t.entity === "savings"
          ? plan.savings.find((i) => i.id === t.id)
          : plan.variableCosts.find((i) => i.id === t.id);
  if (!item || !("amount" in item)) return null;
  return item.amount;
}

export function targetLabel(plan: Plan, t: SetTarget): string {
  if (t.entity === "settings") return SETTINGS_FIELD_LABEL[t.field];
  if (t.entity === "person") {
    return `${PERSON_FIELD_LABEL[t.field].replace(/ \(.*\)$/, "")} ${itemName(plan, "person", t.id) ?? "?"}`;
  }
  if (t.entity === "car") return `Verbrauch ${itemName(plan, "car", t.id) ?? "?"}`;
  const name = itemName(plan, t.entity, t.id) ?? "(gelöscht)";
  return t.entity === "income" ? `Einkommen ${name}` : name;
}

export type EffectSentence = {
  /** Sentence split around the emphasized value: `${pre} <b>${value}</b> ${post}` */
  pre: string;
  value: string;
  post: string;
  sub: string;
  broken: boolean;
};

/** German sentence for an effect, e.g. "Einkommen Person A auf 0,00 € setzen · statt 2.950,00 €". */
export function describeEffect(plan: Plan, effect: Effect): EffectSentence {
  if (effect.type === "set") {
    const base = baseValue(plan, effect.target);
    const label = targetLabel(plan, effect.target);
    return {
      pre: `${label} auf`,
      value: formatTargetValue(effect.target, effect.value),
      post: "setzen",
      sub:
        base == null
          ? "Ziel existiert nicht mehr"
          : `statt ${formatTargetValue(effect.target, base)}${
              effect.target.entity === "person" || effect.target.entity === "car" ? " · beeinflusst Tankkosten" : ""
            }`,
      broken: base == null,
    };
  }
  const name = itemName(plan, effect.entity, effect.targetId);
  const list = effect.entity === "variable" ? plan.variableCosts : null;
  let amount = "";
  if (effect.entity !== "variable") {
    const t = { entity: effect.entity, id: effect.targetId, field: "amount" } as SetTarget;
    const v = baseValue(plan, t);
    if (v != null) amount = formatEur(v);
  } else {
    const vc = list?.find((v) => v.id === effect.targetId);
    if (vc?.kind === "fixed") amount = formatEur(vc.amount);
  }
  return {
    pre: name ?? "(gelöscht)",
    value: amount,
    post: effect.type === "enable" ? "einschalten" : "ausschalten",
    sub: name == null ? "Ziel existiert nicht mehr" : ENTITY_LABEL[effect.entity],
    broken: name == null,
  };
}

export function effectToText(plan: Plan, effect: Effect): string {
  const s = describeEffect(plan, effect);
  return [s.pre, s.value, s.post].filter(Boolean).join(" ");
}

/** Items whose condition refers to the switch. */
export function conditionedItems(plan: Plan, switchId: string) {
  const out: { entity: ToggleEntity; id: string; name: string; when: "on" | "off" }[] = [];
  const add = (entity: ToggleEntity, items: { id: string; condition: { switchId: string; when: "on" | "off" } | null }[], name: (i: never) => string) => {
    for (const i of items) {
      if (i.condition?.switchId === switchId) out.push({ entity, id: i.id, name: name(i as never), when: i.condition.when });
    }
  };
  add("income", plan.incomes, (i: { label: string }) => i.label);
  add("expense", plan.expenses, (i: { name: string }) => i.name);
  add("variable", plan.variableCosts, (i: { label: string }) => i.label);
  add("savings", plan.savings, (i: { name: string }) => i.name);
  return out;
}

function effectRefersTo(e: Effect, entity: ToggleEntity | "person" | "car", id: string): boolean {
  if (e.type === "set") return e.target.entity === entity && "id" in e.target && e.target.id === id;
  return e.entity === entity && e.targetId === id;
}

function dropEffects(plan: Plan, entity: ToggleEntity | "person" | "car", id: string): void {
  plan.switches = plan.switches.map((s) => ({
    ...s,
    effects: s.effects.filter((e) => !effectRefersTo(e, entity, id)),
  }));
}

/** Removes an item and every switch effect pointing at it. Mutates `plan`. */
export function removeItem(plan: Plan, entity: ToggleEntity, id: string): void {
  switch (entity) {
    case "income":
      plan.incomes = plan.incomes.filter((i) => i.id !== id);
      break;
    case "expense":
      plan.expenses = plan.expenses.filter((i) => i.id !== id);
      break;
    case "variable":
      plan.variableCosts = plan.variableCosts.filter((i) => i.id !== id);
      break;
    case "savings":
      plan.savings = plan.savings.filter((i) => i.id !== id);
      break;
  }
  dropEffects(plan, entity, id);
}

/** Nothing entered yet (only the default categories): the app greets with the start screen. */
export function isBlankPlan(plan: Plan): boolean {
  return (
    plan.persons.length === 0 &&
    plan.incomes.length === 0 &&
    plan.expenses.length === 0 &&
    plan.variableCosts.length === 0 &&
    plan.savings.length === 0 &&
    plan.accounts.length === 0 &&
    plan.switches.length === 0
  );
}

/** Adds a person (and, with commute costs on, their fuel line). Mutates `plan`; returns the new id. */
export function addPerson(plan: Plan, name: string): string {
  const id = newId("p");
  plan.persons.push({
    id,
    name,
    color: PERSON_COLORS[plan.persons.length % PERSON_COLORS.length],
    officeDaysPerWeek: 0,
    commuteKm: 0,
    carId: plan.cars[0]?.id ?? null,
  });
  if (plan.settings.commute) {
    plan.variableCosts.push({ id: newId("var"), label: `Tanken ${name}`, kind: "commute-fuel", personId: id, active: true, condition: null });
  }
  return id;
}

/** Removes a person, their commute fuel lines and effects; unlinks incomes. Mutates `plan`. */
export function removePerson(plan: Plan, id: string): void {
  plan.persons = plan.persons.filter((p) => p.id !== id);
  plan.incomes = plan.incomes.map((i) => (i.personId === id ? { ...i, personId: null } : i));
  const fuel = plan.variableCosts.filter((v) => v.kind === "commute-fuel" && v.personId === id);
  for (const v of fuel) removeItem(plan, "variable", v.id);
  dropEffects(plan, "person", id);
}

/** Removes a car and its effects; its drivers end up without a car. Mutates `plan`. */
export function removeCar(plan: Plan, id: string): void {
  plan.cars = plan.cars.filter((c) => c.id !== id);
  plan.persons = plan.persons.map((p) => (p.carId === id ? { ...p, carId: null } : p));
  dropEffects(plan, "car", id);
}

/** Removes a switch and clears conditions that referred to it. Mutates `plan`. */
export function removeSwitch(plan: Plan, id: string): void {
  plan.switches = plan.switches.filter((s) => s.id !== id);
  const clear = <T extends { condition: { switchId: string } | null }>(items: T[]): T[] =>
    items.map((i) => (i.condition?.switchId === id ? { ...i, condition: null } : i));
  plan.incomes = clear(plan.incomes);
  plan.expenses = clear(plan.expenses);
  plan.variableCosts = clear(plan.variableCosts);
  plan.savings = clear(plan.savings);
}

/** Removes a category; its expenses move to `moveTo` (or become uncategorized). Mutates `plan`. */
export function removeCategory(plan: Plan, id: string, moveTo: string | null = null): void {
  plan.categories = plan.categories.filter((c) => c.id !== id);
  plan.expenses = plan.expenses.map((e) => (e.categoryId === id ? { ...e, categoryId: moveTo } : e));
}

/** Removes a savings account and unlinks buckets / the surplus routed to it. Mutates `plan`. */
export function removeAccount(plan: Plan, id: string): void {
  plan.accounts = plan.accounts.filter((a) => a.id !== id);
  plan.savings = plan.savings.map((s) => (s.accountId === id ? { ...s, accountId: null } : s));
  if (plan.settings.surplusAccountId === id) plan.settings = { ...plan.settings, surplusAccountId: null };
}

/** Moves an element within an array (returns a new array). */
export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length) return arr;
  const copy = arr.slice();
  const [x] = copy.splice(from, 1);
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, x);
  return copy;
}

/** Moves the item with `id` before the item with `beforeId` (or to the end). */
/** Moves `id` before `targetId` (the end if null), or right after it with `after`. */
export function moveById<T extends { id: string }>(arr: T[], id: string, targetId: string | null, after = false): T[] {
  const from = arr.findIndex((x) => x.id === id);
  if (from < 0 || id === targetId) return arr;
  const copy = arr.slice();
  const [x] = copy.splice(from, 1);
  const to = targetId == null ? copy.length : copy.findIndex((y) => y.id === targetId);
  copy.splice(to < 0 ? copy.length : to + (after ? 1 : 0), 0, x);
  return copy;
}

export type ExpenseSortKey = "name" | "provider" | "interval" | "amount" | "monthly";
export type ExpenseSort = { key: ExpenseSortKey; dir: "asc" | "desc" };

/** Next state of a column header click: first direction, the opposite, then back to manual order. */
export function nextExpenseSort(current: ExpenseSort | null, key: ExpenseSortKey): ExpenseSort | null {
  const first = key === "amount" || key === "monthly" ? "desc" : "asc";
  if (current?.key !== key) return { key, dir: first };
  return current.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null;
}

/** Sorted copy; `null` keeps the manual order. Rows without a provider stay last in both directions. */
export function sortExpenses<T extends { name: string; provider: string; interval: Interval; amount: number; id: string }>(
  items: T[],
  sort: ExpenseSort | null,
  monthly: (item: T) => number,
): T[] {
  if (!sort) return items;
  const sign = sort.dir === "asc" ? 1 : -1;
  const text = (a: string, b: string) => a.localeCompare(b, "de-DE", { sensitivity: "base", numeric: true });
  return items.slice().sort((a, b) => {
    switch (sort.key) {
      case "name":
        return sign * text(a.name, b.name);
      case "provider":
        if (!a.provider || !b.provider) return Number(!a.provider) - Number(!b.provider);
        return sign * text(a.provider, b.provider);
      case "interval":
        return sign * (INTERVALS.indexOf(a.interval) - INTERVALS.indexOf(b.interval));
      case "amount":
        return sign * (a.amount - b.amount);
      case "monthly":
        return sign * (monthly(a) - monthly(b));
    }
  });
}
