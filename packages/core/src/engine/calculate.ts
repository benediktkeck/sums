import type {
  Car,
  Effect,
  Expense,
  Interval,
  Person,
  Plan,
  SetTarget,
  Settings,
  Switch,
  ToggleEntity,
} from "../model/schema";

/** Pure, framework-free budget calculation. See docs/PLAN.md. */

export const INTERVAL_DIVISOR: Record<Interval, number> = {
  monthly: 1,
  quarterly: 3,
  "half-yearly": 6,
  yearly: 12,
};

export function monthlyEquivalent(amount: number, interval: Interval): number {
  return amount / INTERVAL_DIVISOR[interval];
}

export function fuelPrice(settings: Settings, car: Pick<Car, "fuelType">): number {
  return car.fuelType === "diesel" ? settings.fuelPriceDiesel : settings.fuelPriceE10;
}

export function carOf(plan: Pick<Plan, "cars">, person: Pick<Person, "carId">): Car | undefined {
  return plan.cars.find((c) => c.id === person.carId);
}

/** officeDays × 2 × weeksPerMonth × km / 100 × consumption × price(fuelType); 0 without a car. */
export function commuteFuelCost(person: Person, car: Car | undefined, settings: Settings): number {
  if (!car) return 0;
  return (
    ((person.officeDaysPerWeek * 2 * settings.weeksPerMonth * person.commuteKm) / 100) *
    car.consumption *
    fuelPrice(settings, car)
  );
}

export type StatusReason = {
  /** `condition`: the item's own condition; `effect`: an enable/disable effect. */
  kind: "condition" | "effect";
  switchId: string;
  switchName: string;
};

export type ItemStatus = {
  active: boolean;
  /** Set when a switch decided the item's state. */
  reason: StatusReason | null;
};

export type Override = {
  switchId: string;
  switchName: string;
  original: number;
  value: number;
};

export function overrideKey(target: SetTarget): string {
  return target.entity === "settings"
    ? `settings::${target.field}`
    : `${target.entity}:${target.id}:${target.field}`;
}

type ToggleRecord = { active: boolean; switchId: string; switchName: string };

type Applied = {
  plan: Plan;
  toggles: Map<string, ToggleRecord>;
  overrides: Map<string, Override>;
};

function readTarget(plan: Plan, target: SetTarget): number | undefined {
  if (target.entity === "settings") return plan.settings[target.field];
  if (target.entity === "person") {
    return plan.persons.find((p) => p.id === target.id)?.[target.field];
  }
  if (target.entity === "car") return plan.cars.find((c) => c.id === target.id)?.[target.field];
  const list = listFor(plan, target.entity);
  const item = list.find((i) => i.id === target.id);
  if (!item || !("amount" in item)) return undefined;
  return item.amount;
}

function writeTarget(plan: Plan, target: SetTarget, value: number): void {
  if (target.entity === "settings") {
    plan.settings = { ...plan.settings, [target.field]: value };
    return;
  }
  if (target.entity === "person") {
    plan.persons = plan.persons.map((p) =>
      p.id === target.id ? { ...p, [target.field]: value } : p,
    );
    return;
  }
  if (target.entity === "car") {
    plan.cars = plan.cars.map((c) => (c.id === target.id ? { ...c, [target.field]: value } : c));
    return;
  }
  switch (target.entity) {
    case "income":
      plan.incomes = plan.incomes.map((i) => (i.id === target.id ? { ...i, amount: value } : i));
      return;
    case "expense":
      plan.expenses = plan.expenses.map((i) => (i.id === target.id ? { ...i, amount: value } : i));
      return;
    case "savings":
      plan.savings = plan.savings.map((i) => (i.id === target.id ? { ...i, amount: value } : i));
      return;
    case "variable":
      plan.variableCosts = plan.variableCosts.map((i) =>
        i.id === target.id && i.kind === "fixed" ? { ...i, amount: value } : i,
      );
      return;
  }
}

export function listFor(plan: Plan, entity: ToggleEntity) {
  switch (entity) {
    case "income":
      return plan.incomes;
    case "expense":
      return plan.expenses;
    case "variable":
      return plan.variableCosts;
    case "savings":
      return plan.savings;
  }
}

function applyEffect(applied: Applied, sw: Switch, effect: Effect): void {
  if (effect.type === "set") {
    const key = overrideKey(effect.target);
    const current = readTarget(applied.plan, effect.target);
    if (current === undefined) return; // dangling reference: ignore
    const original = applied.overrides.get(key)?.original ?? current;
    writeTarget(applied.plan, effect.target, effect.value);
    applied.overrides.set(key, {
      switchId: sw.id,
      switchName: sw.name,
      original,
      value: effect.value,
    });
    return;
  }
  applied.toggles.set(`${effect.entity}:${effect.targetId}`, {
    active: effect.type === "enable",
    switchId: sw.id,
    switchName: sw.name,
  });
}

/** Applies the effects of all switches that are on, in switch order. Later effects win. */
export function applySwitches(plan: Plan): Applied {
  const applied: Applied = {
    plan: structuredClone(plan),
    toggles: new Map(),
    overrides: new Map(),
  };
  for (const sw of plan.switches) {
    if (!sw.on) continue;
    for (const effect of sw.effects) applyEffect(applied, sw, effect);
  }
  return applied;
}

function resolveStatus(
  plan: Plan,
  toggles: Map<string, ToggleRecord>,
  entity: ToggleEntity,
  item: { id: string; active: boolean; condition: { switchId: string; when: "on" | "off" } | null },
): ItemStatus {
  const toggle = toggles.get(`${entity}:${item.id}`);
  let active = item.active;
  let reason: StatusReason | null = null;
  if (toggle) {
    active = toggle.active;
    reason = { kind: "effect", switchId: toggle.switchId, switchName: toggle.switchName };
  }
  if (item.condition) {
    const sw = plan.switches.find((s) => s.id === item.condition!.switchId);
    if (sw) {
      const met = item.condition.when === "on" ? sw.on : !sw.on;
      if (!met) {
        active = false;
        reason = { kind: "condition", switchId: sw.id, switchName: sw.name };
      }
    }
  }
  return { active, reason };
}

export type ExpenseResult = {
  status: ItemStatus;
  monthly: number;
  /** monthly interval → fixed costs; others → periodic reserve (savings). */
  bucket: "fixed" | "reserve";
};

export type CalcResult = {
  /** The plan after switch effects (amounts as they count). */
  effective: Plan;
  overrides: Record<string, Override>;
  status: Record<ToggleEntity, Record<string, ItemStatus>>;
  /** `items`: what counts (0 when inactive); `raw`: the value the item would have if active. */
  income: { total: number; items: Record<string, number>; raw: Record<string, number> };
  expenses: Record<string, ExpenseResult>;
  fixed: { total: number; byCategory: Record<string, number> };
  /** Monthly equivalents of active non-monthly expenses, per category and in total. */
  reserveByCategory: Record<string, number>;
  periodic: number;
  variable: { total: number; items: Record<string, number>; raw: Record<string, number> };
  savings: { total: number; periodic: number; buckets: number; items: Record<string, number>; raw: Record<string, number> };
  free: number;
  /**
   * Pocket money per person. `share` is each person's part of the free amount
   * before the cap (0 with split mode "none"); `perPerson` is what they get.
   */
  allowance: { perPerson: Record<string, number>; share: Record<string, number>; total: number };
  surplus: number;
  /** Positive amount missing when free < 0, otherwise 0. */
  shortfall: number;
};

export const NO_CATEGORY = "__none__";

export function calculate(plan: Plan): CalcResult {
  const { plan: eff, toggles, overrides } = applySwitches(plan);
  const status: CalcResult["status"] = { income: {}, expense: {}, variable: {}, savings: {} };

  let incomeTotal = 0;
  const incomeItems: Record<string, number> = {};
  const incomeRaw: Record<string, number> = {};
  for (const inc of eff.incomes) {
    const st = resolveStatus(eff, toggles, "income", inc);
    status.income[inc.id] = st;
    incomeRaw[inc.id] = inc.amount;
    const v = st.active ? inc.amount : 0;
    incomeItems[inc.id] = v;
    incomeTotal += v;
  }

  const expenses: Record<string, ExpenseResult> = {};
  const byCategory: Record<string, number> = {};
  const reserveByCategory: Record<string, number> = {};
  let fixedTotal = 0;
  let periodic = 0;
  for (const exp of eff.expenses) {
    const st = resolveStatus(eff, toggles, "expense", exp);
    status.expense[exp.id] = st;
    const monthly = monthlyEquivalent(exp.amount, exp.interval);
    const bucket = exp.interval === "monthly" ? "fixed" : "reserve";
    expenses[exp.id] = { status: st, monthly, bucket };
    const cat = exp.categoryId ?? NO_CATEGORY;
    byCategory[cat] ??= 0;
    reserveByCategory[cat] ??= 0;
    if (!st.active) continue;
    if (bucket === "fixed") {
      fixedTotal += monthly;
      byCategory[cat] += monthly;
    } else {
      periodic += monthly;
      reserveByCategory[cat] += monthly;
    }
  }

  let variableTotal = 0;
  const variableItems: Record<string, number> = {};
  const variableRaw: Record<string, number> = {};
  for (const vc of eff.variableCosts) {
    const st = resolveStatus(eff, toggles, "variable", vc);
    status.variable[vc.id] = st;
    let v = 0;
    if (vc.kind === "fixed") v = vc.amount;
    else {
      const person = eff.persons.find((p) => p.id === vc.personId);
      v = person ? commuteFuelCost(person, carOf(eff, person), eff.settings) : 0;
    }
    variableRaw[vc.id] = v;
    variableItems[vc.id] = st.active ? v : 0;
    variableTotal += variableItems[vc.id];
  }

  let buckets = 0;
  const savingsItems: Record<string, number> = {};
  const savingsRaw: Record<string, number> = {};
  for (const s of eff.savings) {
    const st = resolveStatus(eff, toggles, "savings", s);
    status.savings[s.id] = st;
    savingsRaw[s.id] = s.amount;
    savingsItems[s.id] = st.active ? s.amount : 0;
    buckets += savingsItems[s.id];
  }
  const savingsTotal = periodic + buckets;

  const free = incomeTotal - fixedTotal - variableTotal - savingsTotal;
  const share = splitShares(eff, incomeItems, free);
  const perPerson: Record<string, number> = {};
  let allowanceTotal = 0;
  for (const p of eff.persons) {
    const a = Math.max(0, Math.min(share[p.id], eff.settings.allowanceCap));
    perPerson[p.id] = a;
    allowanceTotal += a;
  }

  return {
    effective: eff,
    overrides: Object.fromEntries(overrides),
    status,
    income: { total: incomeTotal, items: incomeItems, raw: incomeRaw },
    expenses,
    fixed: { total: fixedTotal, byCategory },
    reserveByCategory,
    periodic,
    variable: { total: variableTotal, items: variableItems, raw: variableRaw },
    savings: { total: savingsTotal, periodic, buckets, items: savingsItems, raw: savingsRaw },
    free,
    allowance: { perPerson, share, total: allowanceTotal },
    surplus: Math.max(0, free - allowanceTotal),
    shortfall: free < 0 ? -free : 0,
  };
}

/**
 * Each person's part of the free amount, by split mode. "income" weighs by the
 * counted incomes assigned to each person; without any it falls back to equal.
 */
export function splitShares(plan: Plan, incomeItems: Record<string, number>, free: number): Record<string, number> {
  const persons = plan.persons;
  const shares: Record<string, number> = {};
  const mode = plan.settings.splitMode;
  if (mode === "none" || persons.length === 0) {
    for (const p of persons) shares[p.id] = 0;
    return shares;
  }
  const income: Record<string, number> = Object.fromEntries(persons.map((p) => [p.id, 0]));
  for (const inc of plan.incomes) {
    if (inc.personId != null && inc.personId in income) income[inc.personId] += Math.max(0, incomeItems[inc.id] ?? 0);
  }
  const total = Object.values(income).reduce((a, b) => a + b, 0);
  for (const p of persons) {
    shares[p.id] = mode === "income" && total > 0 ? (free * income[p.id]) / total : free / persons.length;
  }
  return shares;
}

/** Result of the plan with one switch forced on or off (for the impact preview). */
export function calculateWithSwitch(plan: Plan, switchId: string, on: boolean): CalcResult {
  return calculate({
    ...plan,
    switches: plan.switches.map((s) => (s.id === switchId ? { ...s, on } : s)),
  });
}

export function isPeriodic(expense: Pick<Expense, "interval">): boolean {
  return expense.interval !== "monthly";
}
