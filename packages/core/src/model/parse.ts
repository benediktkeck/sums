import { planSchema, SCHEMA_VERSION, type Plan } from "./schema";

type Doc = Record<string, unknown> & { schemaVersion?: number };

/** One step per schema version: migrations[n] turns a version-n document into n+1. */
const migrations: Record<number, (doc: Doc) => Doc> = {
  // v2: savings accounts (Sparkonten) and the bucket → account link.
  1: (doc) => ({
    ...doc,
    schemaVersion: 2,
    savings: ((doc.savings as Doc[]) ?? []).map((s) => ({ accountId: null, ...s })),
    accounts: [],
    settings: { surplusAccountId: null, ...(doc.settings as Doc) },
  }),
  // v3: cars split off persons. Every person keeps their car, so all amounts stay the same.
  2: (doc) => {
    const carId = (personId: unknown) => `car-${String(personId)}`;
    const persons = (doc.persons as Doc[]) ?? [];
    return {
      ...doc,
      schemaVersion: 3,
      cars: persons.map((p) => ({ id: carId(p.id), name: `Auto ${String(p.name)}`, consumption: p.consumption, fuelType: p.fuelType })),
      persons: persons.map((p) => ({ ...p, carId: carId(p.id) })),
      switches: ((doc.switches as Doc[]) ?? []).map((s) => ({
        ...s,
        effects: ((s.effects as Doc[]) ?? []).map((e) => {
          const t = e.target as Doc | undefined;
          return t?.entity === "person" && t.field === "consumption"
            ? { ...e, target: { entity: "car", id: carId(t.id), field: "consumption" } }
            : e;
        }),
      })),
    };
  },
  // v4: accounts can be depots. Existing ones stay plain accounts, the projection doesn't change.
  3: (doc) => ({
    ...doc,
    schemaVersion: 4,
    accounts: ((doc.accounts as Doc[]) ?? []).map((a) => ({ kind: "account", ...a })),
  }),
  // v5: split mode and the optional commute module. Existing plans keep the equal split,
  // and keep commute costs on when they use them.
  4: (doc) => {
    const usesCommute =
      ((doc.cars as Doc[]) ?? []).length > 0 ||
      ((doc.variableCosts as Doc[]) ?? []).some((v) => v.kind === "commute-fuel") ||
      ((doc.persons as Doc[]) ?? []).some((p) => Number(p.commuteKm) > 0);
    return {
      ...doc,
      schemaVersion: 5,
      settings: { splitMode: "equal", commute: usesCommute, ...(doc.settings as Doc) },
    };
  },
};

/** Validates a stored plan document, migrating older schema versions first. */
export function parsePlan(data: unknown): Plan {
  if (!data || typeof data !== "object") return planSchema.parse(data);
  let doc = data as Doc;
  while (doc.schemaVersion !== SCHEMA_VERSION) {
    const step: ((d: Doc) => Doc) | undefined = migrations[doc.schemaVersion as number];
    if (!step) throw new Error(`Unbekannte Schema-Version: ${String(doc.schemaVersion)}`);
    doc = step(doc);
  }
  return planSchema.parse(doc);
}
