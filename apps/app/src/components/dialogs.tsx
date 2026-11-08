"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { useState } from "react";
import { formatEur } from "@sums/core/format";
import { newId, removeItem } from "@sums/core/model/ops";
import type { Expense, Income, SavingsBucket, VariableCost } from "@sums/core/model/schema";
import { carOf, commuteFuelCost } from "@sums/core/engine/calculate";
import { Select } from "@/components/ui/select";
import { usePlan } from "./plan-provider";
import { CatDot, INTERVAL_OPTIONS, personOptions } from "./select-options";
import { ActiveCheck, ConditionSelect, Field, FormDialog, NumberInput } from "./ui-bits";

/** Dialogs to create or edit one item. On mobile they are the only way to edit amounts. */

export function ExpenseDialog({
  id,
  defaultCategoryId,
  preset,
  onClose,
}: {
  id: string | null;
  defaultCategoryId?: string | null;
  /** Prefill for a new item (examples on the empty page). */
  preset?: Partial<Pick<Expense, "name" | "categoryId" | "interval">>;
  onClose: () => void;
}) {
  const { plan, update } = usePlan();
  const existing = id ? plan.expenses.find((e) => e.id === id) : undefined;
  const [d, setD] = useState<Expense>(
    () =>
      existing ?? {
        id: newId("exp"),
        name: "",
        provider: "",
        amount: 0,
        interval: "monthly",
        categoryId: defaultCategoryId ?? plan.categories[0]?.id ?? null,
        active: true,
        condition: null,
        notes: "",
        ...preset,
      },
  );
  const set = (patch: Partial<Expense>) => setD({ ...d, ...patch });
  const save = () => {
    const item = { ...d, name: d.name.trim(), provider: d.provider.trim() };
    update(
      (p) => {
        if (existing) p.expenses = p.expenses.map((e) => (e.id === item.id ? item : e));
        else {
          // Insert after the last item of the same category so groups stay together.
          const lastIdx = p.expenses.findLastIndex((e) => e.categoryId === item.categoryId);
          if (lastIdx < 0) p.expenses.push(item);
          else p.expenses.splice(lastIdx + 1, 0, item);
        }
      },
      { summary: existing ? `„${item.name}“ bearbeitet` : `Neue Ausgabe „${item.name}“` },
    );
    onClose();
  };
  return (
    <FormDialog
      title={existing ? "Ausgabe bearbeiten" : "Neue Ausgabe"}
      onClose={onClose}
      onSave={save}
      canSave={d.name.trim().length > 0}
      onDelete={
        existing
          ? () => {
              update((p) => removeItem(p, "expense", existing.id), { summary: `„${existing.name}“ gelöscht` });
              onClose();
            }
          : undefined
      }
    >
      <div className="row2">
        <Field label="Was" htmlFor="exp-name">
          <input {...NO_AUTOFILL} id="exp-name" className="field" autoFocus={!preset?.name} value={d.name} placeholder="z. B. Internet" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Anbieter" htmlFor="exp-provider">
          <input {...NO_AUTOFILL} id="exp-provider" className="field" value={d.provider} placeholder="optional" onChange={(e) => set({ provider: e.target.value })} />
        </Field>
      </div>
      <div className="row2">
        <Field label="Betrag" htmlFor="exp-amount">
          <NumberInput id="exp-amount" className="field num" label="Betrag" autoFocus={!!preset?.name} value={d.amount} min={0} onChange={(v) => set({ amount: v })} />
        </Field>
        <Field label="Wie oft" htmlFor="exp-interval">
          <Select id="exp-interval" value={d.interval} options={INTERVAL_OPTIONS} onChange={(v) => set({ interval: v as Expense["interval"] })} />
        </Field>
      </div>
      {d.interval !== "monthly" && (
        <p className="note !mt-2 text-sav">
          Wird angespart: {formatEur(d.amount / { quarterly: 3, "half-yearly": 6, yearly: 12 }[d.interval])} pro Monat wandern in die
          Rücklagen.
        </p>
      )}
      <div className="row2">
        <Field label="Kategorie" htmlFor="exp-cat">
          <Select
            id="exp-cat"
            value={d.categoryId ?? ""}
            onChange={(v) => set({ categoryId: v || null })}
            options={[
              ...plan.categories.map((c) => ({ value: c.id, label: c.name, icon: <CatDot color={c.color} /> })),
              { value: "", label: "Ohne Kategorie", icon: <CatDot color="var(--fg-3)" /> },
            ]}
          />
        </Field>
        <Field label="Aktiv">
          <ConditionSelect plan={plan} value={d.condition} onChange={(condition) => set({ condition })} />
        </Field>
      </div>
      <ActiveCheck on={d.active} onToggle={(active) => set({ active })} />
      <Field label="Notizen" htmlFor="exp-notes">
        <textarea {...NO_AUTOFILL} id="exp-notes" className="field" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </FormDialog>
  );
}

export function IncomeDialog({
  id,
  preset,
  onClose,
}: {
  id: string | null;
  preset?: Partial<Pick<Income, "label" | "personId">>;
  onClose: () => void;
}) {
  const { plan, update } = usePlan();
  const existing = id ? plan.incomes.find((e) => e.id === id) : undefined;
  const [d, setD] = useState<Income>(
    () => existing ?? { id: newId("inc"), label: "", personId: null, amount: 0, active: true, condition: null, ...preset },
  );
  const set = (patch: Partial<Income>) => setD({ ...d, ...patch });
  const save = () => {
    const item = { ...d, label: d.label.trim() };
    update(
      (p) => {
        if (existing) p.incomes = p.incomes.map((e) => (e.id === item.id ? item : e));
        else p.incomes.push(item);
      },
      { summary: existing ? `Einkommen „${item.label}“ bearbeitet` : `Neues Einkommen „${item.label}“` },
    );
    onClose();
  };
  return (
    <FormDialog
      title={existing ? "Einkommen bearbeiten" : "Neues Einkommen"}
      onClose={onClose}
      onSave={save}
      canSave={d.label.trim().length > 0}
      onDelete={
        existing
          ? () => {
              update((p) => removeItem(p, "income", existing.id), { summary: `Einkommen „${existing.label}“ gelöscht` });
              onClose();
            }
          : undefined
      }
    >
      <Field label="Bezeichnung" htmlFor="inc-label">
        <input {...NO_AUTOFILL} id="inc-label" className="field" autoFocus={!preset?.label} value={d.label} placeholder="z. B. Gehalt" onChange={(e) => set({ label: e.target.value })} />
      </Field>
      <div className="row2">
        <Field label="Betrag pro Monat (netto)" htmlFor="inc-amount">
          <NumberInput id="inc-amount" className="field num" label="Betrag" autoFocus={!!preset?.label} value={d.amount} onChange={(v) => set({ amount: v })} />
        </Field>
        <Field label="Person" htmlFor="inc-person">
          <Select
            id="inc-person"
            value={d.personId ?? ""}
            onChange={(v) => set({ personId: v || null })}
            options={[{ value: "", label: "Gemeinsam / keine" }, ...personOptions(plan)]}
          />
        </Field>
      </div>
      <Field label="Aktiv">
        <ConditionSelect plan={plan} value={d.condition} onChange={(condition) => set({ condition })} />
      </Field>
      <ActiveCheck on={d.active} onToggle={(active) => set({ active })} hint="Szenarien können es zusätzlich ein- oder ausschalten" />
    </FormDialog>
  );
}

export function VariableDialog({ id, preset, onClose }: { id: string | null; preset?: { label: string }; onClose: () => void }) {
  const { plan, update } = usePlan();
  const existing = id ? plan.variableCosts.find((e) => e.id === id) : undefined;
  const [d, setD] = useState<VariableCost>(
    () => existing ?? { id: newId("var"), label: "", kind: "fixed", amount: 0, active: true, condition: null, ...preset },
  );
  const save = () => {
    const item = { ...d, label: d.label.trim() };
    update(
      (p) => {
        if (existing) p.variableCosts = p.variableCosts.map((e) => (e.id === item.id ? item : e));
        else p.variableCosts.push(item);
      },
      { summary: existing ? `„${item.label}“ bearbeitet` : `Neue variable Kosten „${item.label}“` },
    );
    onClose();
  };
  const person = d.kind === "commute-fuel" ? plan.persons.find((p) => p.id === d.personId) : undefined;
  const canSave = d.label.trim().length > 0 && (d.kind === "fixed" || !!person);
  return (
    <FormDialog
      title={existing ? "Variable Kosten bearbeiten" : "Neue variable Kosten"}
      onClose={onClose}
      onSave={save}
      canSave={canSave}
      onDelete={
        existing
          ? () => {
              update((p) => removeItem(p, "variable", existing.id), { summary: `„${existing.label}“ gelöscht` });
              onClose();
            }
          : undefined
      }
    >
      {/* Commute fuel is an optional module; an existing fuel line stays editable either way. */}
      {(plan.settings.commute || d.kind === "commute-fuel") && (
        <Field label="Art">
          <div className="seg w-fit">
            <button
              type="button"
              className={d.kind === "fixed" ? "a" : ""}
              onClick={() => setD({ id: d.id, label: d.label, active: d.active, condition: d.condition, kind: "fixed", amount: 0 })}
            >
              Fester Betrag
            </button>
            <button
              type="button"
              className={d.kind === "commute-fuel" ? "a" : ""}
              onClick={() => {
                const p = plan.persons[0];
                setD({
                  id: d.id,
                  label: d.label || (p ? `Tanken ${p.name}` : "Tanken"),
                  active: d.active,
                  condition: d.condition,
                  kind: "commute-fuel",
                  personId: p?.id ?? "",
                });
              }}
            >
              Tankkosten Arbeitsweg
            </button>
          </div>
        </Field>
      )}
      <Field label="Bezeichnung" htmlFor="var-label">
        <input {...NO_AUTOFILL} id="var-label" className="field" autoFocus={!preset?.label} value={d.label} placeholder="z. B. Lebensmittel" onChange={(e) => setD({ ...d, label: e.target.value })} />
      </Field>
      {d.kind === "fixed" ? (
        <Field label="Betrag pro Monat" htmlFor="var-amount">
          <NumberInput id="var-amount" className="field num" label="Betrag" autoFocus={!!preset?.label} value={d.amount} min={0} onChange={(v) => setD({ ...d, amount: v })} />
        </Field>
      ) : (
        <>
          <Field label="Person" htmlFor="var-person">
            <Select
              id="var-person"
              value={d.personId}
              onChange={(v) => setD({ ...d, personId: v })}
              placeholder="Zuerst eine Person anlegen"
              disabled={plan.persons.length === 0}
              options={personOptions(plan)}
            />
          </Field>
          {person && (
            <p className="note">
              Berechnet aus Bürotagen und Arbeitsweg der Person und dem Verbrauch ihres Autos: derzeit{" "}
              <b className="n text-fg">{formatEur(commuteFuelCost(person, carOf(plan, person), plan.settings))}</b> pro Monat.
            </p>
          )}
        </>
      )}
      <Field label="Aktiv">
        <ConditionSelect plan={plan} value={d.condition} onChange={(condition) => setD({ ...d, condition })} />
      </Field>
    </FormDialog>
  );
}

export function SavingsDialog({ id, preset, onClose }: { id: string | null; preset?: { name: string }; onClose: () => void }) {
  const { plan, update } = usePlan();
  const existing = id ? plan.savings.find((e) => e.id === id) : undefined;
  const [d, setD] = useState<SavingsBucket>(
    () => existing ?? { id: newId("sav"), name: "", amount: 0, active: true, condition: null, accountId: null, ...preset },
  );
  const save = () => {
    const item = { ...d, name: d.name.trim() };
    update(
      (p) => {
        if (existing) p.savings = p.savings.map((e) => (e.id === item.id ? item : e));
        else p.savings.push(item);
      },
      { summary: existing ? `Rücklage „${item.name}“ bearbeitet` : `Neue Rücklage „${item.name}“` },
    );
    onClose();
  };
  return (
    <FormDialog
      title={existing ? "Rücklage bearbeiten" : "Neue Rücklage"}
      onClose={onClose}
      onSave={save}
      canSave={d.name.trim().length > 0}
      onDelete={
        existing
          ? () => {
              update((p) => removeItem(p, "savings", existing.id), { summary: `Rücklage „${existing.name}“ gelöscht` });
              onClose();
            }
          : undefined
      }
    >
      <div className="row2">
        <Field label="Name" htmlFor="sav-name">
          <input {...NO_AUTOFILL} id="sav-name" className="field" autoFocus={!preset?.name} value={d.name} placeholder="z. B. Notgroschen" onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label="Betrag pro Monat" htmlFor="sav-amount">
          <NumberInput id="sav-amount" className="field num" label="Betrag" autoFocus={!!preset?.name} value={d.amount} min={0} onChange={(v) => setD({ ...d, amount: v })} />
        </Field>
      </div>
      <div className="row2">
        <Field label="Aktiv">
          <ConditionSelect plan={plan} value={d.condition} onChange={(condition) => setD({ ...d, condition })} />
        </Field>
        <Field label="Überweisen auf" htmlFor="sav-account">
          <Select
            id="sav-account"
            value={d.accountId ?? ""}
            onChange={(v) => setD({ ...d, accountId: v || null })}
            options={[
              { value: "", label: "Kein Sparkonto" },
              ...plan.accounts.map((a) => ({ value: a.id, label: a.name || "(ohne Namen)", icon: <CatDot color={a.color} /> })),
            ]}
          />
        </Field>
      </div>
    </FormDialog>
  );
}
