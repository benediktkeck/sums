import { z } from "zod";

/**
 * The whole plan is a single JSON document. Bump SCHEMA_VERSION and add a
 * migration in `parse.ts` whenever the shape changes incompatibly.
 */
export const SCHEMA_VERSION = 5;

const id = z.string().min(1);
const money = z.number().finite();
const nonNegative = z.number().finite().min(0);

export const intervalSchema = z.enum(["monthly", "quarterly", "half-yearly", "yearly"]);
export type Interval = z.infer<typeof intervalSchema>;

export const fuelTypeSchema = z.enum(["e10", "diesel"]);
export type FuelType = z.infer<typeof fuelTypeSchema>;

/** "Active only when switch X is on/off". */
export const conditionSchema = z.object({
  switchId: id,
  when: z.enum(["on", "off"]),
});
export type Condition = z.infer<typeof conditionSchema>;

export const carSchema = z.object({
  id,
  name: z.string(),
  consumption: nonNegative,
  fuelType: fuelTypeSchema,
});
export type Car = z.infer<typeof carSchema>;

export const personSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  officeDaysPerWeek: z.number().finite().min(0).max(7),
  commuteKm: nonNegative,
  /** Car this person commutes with; several persons can share one. null = no fuel costs. */
  carId: id.nullable(),
});
export type Person = z.infer<typeof personSchema>;

export const incomeSchema = z.object({
  id,
  label: z.string(),
  personId: id.nullable(),
  amount: money,
  active: z.boolean(),
  condition: conditionSchema.nullable(),
});
export type Income = z.infer<typeof incomeSchema>;

export const categorySchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export const expenseSchema = z.object({
  id,
  name: z.string(),
  provider: z.string(),
  amount: money,
  interval: intervalSchema,
  categoryId: id.nullable(),
  active: z.boolean(),
  condition: conditionSchema.nullable(),
  notes: z.string(),
});
export type Expense = z.infer<typeof expenseSchema>;

const variableBase = {
  id,
  label: z.string(),
  active: z.boolean(),
  condition: conditionSchema.nullable(),
};
export const variableCostSchema = z.discriminatedUnion("kind", [
  z.object({ ...variableBase, kind: z.literal("fixed"), amount: money }),
  z.object({ ...variableBase, kind: z.literal("commute-fuel"), personId: id }),
]);
export type VariableCost = z.infer<typeof variableCostSchema>;

export const savingsBucketSchema = z.object({
  id,
  name: z.string(),
  amount: money,
  active: z.boolean(),
  condition: conditionSchema.nullable(),
  /** Savings account the monthly amount is transferred to. */
  accountId: id.nullable(),
});
export type SavingsBucket = z.infer<typeof savingsBucketSchema>;

export const accountKindSchema = z.enum(["account", "depot"]);
export type AccountKind = z.infer<typeof accountKindSchema>;

/** A real savings account (Sparkonto) or securities depot that buckets pay into; used for the growth projection. */
export const savingsAccountSchema = z.object({
  id,
  name: z.string(),
  kind: accountKindSchema,
  color: z.string(),
  /** Current balance or depot value (start of the projection). */
  balance: money,
  /** Annual interest / expected return in percent, compounded monthly. */
  rate: z.number().finite().min(-100).max(100),
});
export type SavingsAccount = z.infer<typeof savingsAccountSchema>;

/** Entities whose `active` flag can be forced by a switch. */
export const toggleEntitySchema = z.enum(["income", "expense", "variable", "savings"]);
export type ToggleEntity = z.infer<typeof toggleEntitySchema>;

export const setTargetSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("income"), id, field: z.literal("amount") }),
  z.object({ entity: z.literal("expense"), id, field: z.literal("amount") }),
  z.object({ entity: z.literal("variable"), id, field: z.literal("amount") }),
  z.object({ entity: z.literal("savings"), id, field: z.literal("amount") }),
  z.object({
    entity: z.literal("person"),
    id,
    field: z.enum(["officeDaysPerWeek", "commuteKm"]),
  }),
  z.object({ entity: z.literal("car"), id, field: z.literal("consumption") }),
  z.object({
    entity: z.literal("settings"),
    field: z.enum(["allowanceCap", "fuelPriceE10", "fuelPriceDiesel", "weeksPerMonth"]),
  }),
]);
export type SetTarget = z.infer<typeof setTargetSchema>;

export const effectSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("set"), target: setTargetSchema, value: z.number().finite() }),
  z.object({ id, type: z.literal("enable"), entity: toggleEntitySchema, targetId: id }),
  z.object({ id, type: z.literal("disable"), entity: toggleEntitySchema, targetId: id }),
]);
export type Effect = z.infer<typeof effectSchema>;

export const switchSchema = z.object({
  id,
  name: z.string(),
  on: z.boolean(),
  effects: z.array(effectSchema),
});
export type Switch = z.infer<typeof switchSchema>;

/**
 * How the free amount becomes pocket money (Taschengeld):
 * equal = same share per person, income = in proportion to each person's
 * income, none = no pocket money, everything stays surplus.
 */
export const splitModeSchema = z.enum(["equal", "income", "none"]);
export type SplitMode = z.infer<typeof splitModeSchema>;

export const settingsSchema = z.object({
  fuelPriceE10: nonNegative,
  fuelPriceDiesel: nonNegative,
  allowanceCap: nonNegative,
  weeksPerMonth: z.number().finite().positive(),
  /** Account that receives the monthly surplus (Überschuss), if any. */
  surplusAccountId: id.nullable(),
  splitMode: splitModeSchema,
  /** Commute fuel costs (cars, office days, fuel prices) are shown and can be added. */
  commute: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Arrays are ordered; the array position is the display order. */
export const planSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  persons: z.array(personSchema),
  cars: z.array(carSchema),
  incomes: z.array(incomeSchema),
  categories: z.array(categorySchema),
  expenses: z.array(expenseSchema),
  variableCosts: z.array(variableCostSchema),
  savings: z.array(savingsBucketSchema),
  accounts: z.array(savingsAccountSchema),
  switches: z.array(switchSchema),
  settings: settingsSchema,
});
export type Plan = z.infer<typeof planSchema>;

export const DEFAULT_WEEKS_PER_MONTH = 52 / 12;
