import type { Interval, Plan, Settings, SplitMode } from "@sums/core/model/schema";
import { setupProgress, type StepId } from "@/lib/onboarding";

/**
 * Product analytics events. Pure: no PostHog import, so the rules are testable.
 *
 * Privacy rule: events describe what kind of thing was done, never plan
 * content. No amounts, names, labels, providers or notes; only types, schema
 * field names, enum values and counts.
 */

export type ItemType = "person" | "car" | "income" | "category" | "expense" | "variable" | "savings" | "account" | "scenario";

export type AnalyticsEvents = {
  // Start and first-run guide
  plan_started: { source: "own" | "demo" | "backup"; person_count?: number };
  setup_step_completed: { step: StepId; method: "entry" | "skipped" };
  setup_completed: Record<string, never>;
  setup_example_used: { step: StepId; example: string };
  setup_guide_dismissed: Record<string, never>;
  setup_guide_reopened: Record<string, never>;
  demo_own_plan_clicked: Record<string, never>;
  /** First time the plan has an income and a cost: the summary means something. */
  plan_activated: Record<string, never>;
  // Editing (derived from plan diffs, see planChangeEvents)
  item_created: { type: ItemType; interval?: Interval; kind?: string; effect_count?: number };
  item_edited: { type: ItemType; field: string };
  item_deleted: { type: ItemType };
  item_toggled: { type: ItemType; active: boolean };
  items_reordered: { type: ItemType };
  condition_set: { type: ItemType };
  scenario_toggled: { on: boolean; effect_count: number };
  setting_changed: { setting: keyof Settings; value?: string | boolean };
  // Tools
  plan_undo: Record<string, never>;
  plan_redo: Record<string, never>;
  history_opened: Record<string, never>;
  version_restored: Record<string, never>;
  version_labeled: Record<string, never>;
  preview_opened: { page: string };
  period_changed: { period: "month" | "year" };
  backup_exported: Record<string, never>;
  backup_imported: Record<string, never>;
  backup_import_failed: Record<string, never>;
  pwa_installed: Record<string, never>;
};

export type EventName = keyof AnalyticsEvents;
export type AnyEvent = { [E in EventName]: { event: E; props: AnalyticsEvents[E] } }[EventName];

const COLLECTIONS = [
  ["person", "persons"],
  ["car", "cars"],
  ["income", "incomes"],
  ["category", "categories"],
  ["expense", "expenses"],
  ["variable", "variableCosts"],
  ["savings", "savings"],
  ["account", "accounts"],
  ["scenario", "switches"],
] as const satisfies readonly (readonly [ItemType, keyof Plan])[];

const STEP_COLLECTION: Record<StepId, keyof Plan> = {
  income: "incomes",
  fixed: "expenses",
  variable: "variableCosts",
  savings: "savings",
};

/** Settings whose values are enums or switches; the rest are amounts and only reported by name. */
const ENUM_SETTINGS = new Set<keyof Settings>(["splitMode", "commute"]);

type Item = { id: string } & Record<string, unknown>;

function changedFields(a: Item, b: Item): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => k !== "id" && JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

function createdProps(type: ItemType, item: Item): AnalyticsEvents["item_created"] {
  const props: AnalyticsEvents["item_created"] = { type };
  if (type === "expense") props.interval = item.interval as Interval;
  if (type === "variable" || type === "account") props.kind = String(item.kind);
  if (type === "scenario") props.effect_count = (item.effects as unknown[]).length;
  return props;
}

export function isActivated(plan: Plan): boolean {
  return plan.incomes.length > 0 && plan.expenses.length + plan.variableCosts.length + plan.savings.length > 0;
}

/**
 * What one edit did, as analytics events: created, deleted, toggled,
 * reordered or edited items, scenario switches, settings, and milestones
 * (first entry in a setup step, setup complete, plan activated). `skipped`
 * are the setup steps this browser skipped. Content never leaves.
 */
export function planChangeEvents(before: Plan, after: Plan, skipped: readonly string[] = []): AnyEvent[] {
  const out: AnyEvent[] = [];
  for (const [type, key] of COLLECTIONS) {
    const prev = before[key] as Item[];
    const next = after[key] as Item[];
    const prevById = new Map(prev.map((i) => [i.id, i]));
    const nextIds = new Set(next.map((i) => i.id));
    for (const item of next) {
      const old = prevById.get(item.id);
      if (!old) {
        out.push({ event: "item_created", props: createdProps(type, item) });
        continue;
      }
      let fields = changedFields(old, item);
      if (fields.includes("active")) {
        out.push({ event: "item_toggled", props: { type, active: Boolean(item.active) } });
        fields = fields.filter((f) => f !== "active");
      }
      if (type === "scenario" && fields.includes("on")) {
        out.push({ event: "scenario_toggled", props: { on: Boolean(item.on), effect_count: (item.effects as unknown[]).length } });
        fields = fields.filter((f) => f !== "on");
      }
      if (fields.includes("condition") && item.condition && !old.condition) out.push({ event: "condition_set", props: { type } });
      if (fields.length) out.push({ event: "item_edited", props: { type, field: fields.length === 1 ? fields[0] : "multiple" } });
    }
    for (const item of prev) if (!nextIds.has(item.id)) out.push({ event: "item_deleted", props: { type } });
    const kept = prev.filter((i) => nextIds.has(i.id)).map((i) => i.id);
    const keptNext = next.filter((i) => prevById.has(i.id)).map((i) => i.id);
    if (kept.join() !== keptNext.join()) out.push({ event: "items_reordered", props: { type } });
  }

  for (const setting of Object.keys(after.settings) as (keyof Settings)[]) {
    const value = after.settings[setting];
    if (JSON.stringify(before.settings[setting]) === JSON.stringify(value)) continue;
    out.push({
      event: "setting_changed",
      props: ENUM_SETTINGS.has(setting) ? { setting, value: value as SplitMode | boolean } : { setting },
    });
  }

  for (const step of Object.keys(STEP_COLLECTION) as StepId[]) {
    const key = STEP_COLLECTION[step];
    if ((before[key] as unknown[]).length === 0 && (after[key] as unknown[]).length > 0) {
      out.push({ event: "setup_step_completed", props: { step, method: "entry" } });
    }
  }
  if (!setupProgress(before, skipped).complete && setupProgress(after, skipped).complete) out.push({ event: "setup_completed", props: {} });
  if (!isActivated(before) && isActivated(after)) out.push({ event: "plan_activated", props: {} });
  return out;
}

/** Sent with every event while the app is open: plan shape, never content. */
export function planProperties(plan: Plan) {
  return {
    person_count: plan.persons.length,
    scenario_count: plan.switches.length,
    commute_enabled: plan.settings.commute,
    split_mode: plan.settings.splitMode,
  };
}
