"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { Select } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { calculate } from "@sums/core/engine/calculate";
import { formatEur } from "@sums/core/format";
import {
  baseValue,
  conditionedItems,
  describeEffect,
  ENTITY_LABEL,
  newId,
  PERSON_FIELD_LABEL,
  removeSwitch,
  SETTINGS_FIELD_LABEL,
} from "@sums/core/model/ops";
import type { Effect, Plan, SetTarget, Switch, ToggleEntity } from "@sums/core/model/schema";
import { usePlan } from "./plan-provider";
import { Field, FormDialog, NumberInput } from "./ui-bits";

type Draft = { name: string; effects: Effect[]; clearConditions: string[] };

/** Applies the draft to a plan copy (used for saving and for the impact preview). */
function applyDraft(plan: Plan, switchId: string, draft: Draft, on?: boolean): Plan {
  const p = structuredClone(plan);
  const existing = p.switches.find((s) => s.id === switchId);
  const sw: Switch = {
    id: switchId,
    name: draft.name.trim() || "Neues Szenario",
    on: on ?? existing?.on ?? false,
    effects: draft.effects,
  };
  if (existing) p.switches = p.switches.map((s) => (s.id === switchId ? sw : s));
  else p.switches.push(sw);
  const clear = new Set(draft.clearConditions);
  const fix = <T extends { id: string; condition: unknown }>(entity: string, items: T[]) =>
    items.map((i) => (clear.has(`${entity}:${i.id}`) ? { ...i, condition: null } : i));
  p.incomes = fix("income", p.incomes);
  p.expenses = fix("expense", p.expenses);
  p.variableCosts = fix("variable", p.variableCosts);
  p.savings = fix("savings", p.savings);
  return p;
}

export function SwitchDialog({ switchId, onClose }: { switchId: string | null; onClose: () => void }) {
  const { plan, update } = usePlan();
  const existing = switchId ? plan.switches.find((s) => s.id === switchId) : undefined;
  const [id] = useState(() => existing?.id ?? newId("sw"));
  const [draft, setDraft] = useState<Draft>({
    name: existing?.name ?? "",
    effects: existing?.effects ?? [],
    clearConditions: [],
  });
  const [adding, setAdding] = useState(false);

  const conditioned = conditionedItems(plan, id).filter((c) => !draft.clearConditions.includes(`${c.entity}:${c.id}`));

  const impact = useMemo(() => {
    const on = calculate(applyDraft(plan, id, draft, true)).free;
    const off = calculate(applyDraft(plan, id, draft, false)).free;
    return { on, off, diff: on - off };
  }, [plan, id, draft]);

  const save = () => {
    const name = draft.name.trim();
    update(
      (d) => {
        const next = applyDraft(d, id, { ...draft, name });
        Object.assign(d, next);
      },
      { summary: existing ? `Szenario „${name}“ geändert` : `Neues Szenario „${name}“` },
    );
    onClose();
  };

  const del = () => {
    if (!existing) return onClose();
    update((d) => removeSwitch(d, existing.id), { summary: `Szenario „${existing.name}“ gelöscht` });
    onClose();
  };

  return (
    <FormDialog
      title={existing ? "Szenario bearbeiten" : "Neues Szenario"}
      description="Was soll sich ändern, wenn dieses Szenario eingeschaltet ist?"
      onClose={onClose}
      onSave={save}
      onDelete={existing ? del : undefined}
      canSave={draft.name.trim().length > 0 && !adding}
    >
      <Field label="Name" htmlFor="sw-name">
        <input {...NO_AUTOFILL}
          id="sw-name"
          className="field"
          value={draft.name}
          autoFocus={!existing}
          placeholder="z. B. Elterngeld"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>
      <label className="lbl">Änderungen</label>
      {draft.effects.map((e) => {
        const s = describeEffect(plan, e);
        return (
          <div className="eff" key={e.id}>
            <span className="k">
              {s.pre} {s.value && <b className="n">{s.value}</b>} {s.post}
              <small className={s.broken ? "!text-neg" : ""}>{s.sub}</small>
            </span>
            <button type="button" className="rm" onClick={() => setDraft({ ...draft, effects: draft.effects.filter((x) => x.id !== e.id) })}>
              Entfernen
            </button>
          </div>
        );
      })}
      {conditioned.map((c) => (
        <div className="eff" key={`${c.entity}:${c.id}`}>
          <span className="k">
            {c.name} <b>{c.when === "off" ? "ausschalten" : "nur dann aktiv"}</b>
            <small>
              {ENTITY_LABEL[c.entity]} · Bedingung am Eintrag: nur aktiv, wenn Szenario {c.when === "on" ? "an" : "aus"}
            </small>
          </span>
          <button
            type="button"
            className="rm"
            onClick={() => setDraft({ ...draft, clearConditions: [...draft.clearConditions, `${c.entity}:${c.id}`] })}
          >
            Entfernen
          </button>
        </div>
      ))}
      {adding ? (
        <EffectForm
          plan={plan}
          onCancel={() => setAdding(false)}
          onAdd={(e) => {
            setDraft({ ...draft, effects: [...draft.effects, e] });
            setAdding(false);
          }}
        />
      ) : (
        <button type="button" className="eff add" onClick={() => setAdding(true)}>
          + Änderung hinzufügen
        </button>
      )}
      <div className="impact">
        <span>
          Frei verfügbar,
          <br />
          wenn eingeschaltet
        </span>
        <span className="v n">
          {formatEur(impact.on)}
          <small style={{ color: impact.diff < 0 ? "var(--neg)" : impact.diff > 0 ? "var(--pos)" : "var(--fg-3)" }}>
            {Math.abs(impact.diff) < 0.005
              ? "keine Änderung"
              : `${formatEur(Math.abs(impact.diff))} ${impact.diff < 0 ? "weniger" : "mehr"} als ausgeschaltet`}
          </small>
        </span>
      </div>
    </FormDialog>
  );
}

type EffectKind = "set" | "enable" | "disable";
type SetEntity = SetTarget["entity"];

function itemsFor(plan: Plan, entity: SetEntity | ToggleEntity, forSet: boolean): { id: string; name: string }[] {
  switch (entity) {
    case "income":
      return plan.incomes.map((i) => ({ id: i.id, name: i.label }));
    case "expense":
      return plan.expenses.map((i) => ({ id: i.id, name: i.name }));
    case "variable":
      return plan.variableCosts.filter((v) => !forSet || v.kind === "fixed").map((i) => ({ id: i.id, name: i.label }));
    case "savings":
      return plan.savings.map((i) => ({ id: i.id, name: i.name }));
    case "person":
      return plan.persons.map((p) => ({ id: p.id, name: p.name }));
    case "car":
      return plan.cars.map((c) => ({ id: c.id, name: c.name }));
    case "settings":
      return [];
  }
}

function EffectForm({ plan, onAdd, onCancel }: { plan: Plan; onAdd: (e: Effect) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<EffectKind>("set");
  const [entity, setEntity] = useState<SetEntity>("income");
  const [targetId, setTargetId] = useState<string>(plan.incomes[0]?.id ?? "");
  const [personField, setPersonField] = useState<keyof typeof PERSON_FIELD_LABEL>("officeDaysPerWeek");
  const [settingsField, setSettingsField] = useState<keyof typeof SETTINGS_FIELD_LABEL>("allowanceCap");
  const [value, setValue] = useState<number | null>(null);

  // Without commute costs, persons and cars have nothing a scenario could change.
  const commute = plan.settings.commute;
  const entities: SetEntity[] =
    kind === "set"
      ? ["income", "expense", "variable", "savings", ...(commute ? (["person", "car"] as const) : []), "settings"]
      : ["income", "expense", "variable", "savings"];
  const settingsFields = Object.entries(SETTINGS_FIELD_LABEL).filter(([k]) => commute || k === "allowanceCap");
  const items = itemsFor(plan, entity, kind === "set");

  const target: SetTarget | null =
    entity === "settings"
      ? { entity, field: settingsField }
      : !targetId
        ? null
        : entity === "person"
          ? { entity, id: targetId, field: personField }
          : entity === "car"
            ? { entity, id: targetId, field: "consumption" }
            : ({ entity, id: targetId, field: "amount" } as SetTarget);
  const current = target ? baseValue(plan, target) : null;
  const effectiveValue = value ?? current ?? 0;
  const isMoney = entity !== "person" && entity !== "car" && !(entity === "settings" && settingsField === "weeksPerMonth");

  const changeEntity = (e: SetEntity) => {
    setEntity(e);
    setTargetId(itemsFor(plan, e, kind === "set")[0]?.id ?? "");
    setValue(null);
  };

  const submit = () => {
    const id = newId("eff");
    if (kind === "set") {
      if (!target) return;
      onAdd({ id, type: "set", target, value: effectiveValue });
    } else {
      if (!targetId || entity === "person" || entity === "car" || entity === "settings") return;
      onAdd({ id, type: kind, entity, targetId });
    }
  };

  return (
    <div className="eff-form">
      <div className="row2">
        <Field label="Aktion">
          <Select
            aria-label="Aktion"
            value={kind}
            onChange={(v) => {
              const k = v as EffectKind;
              setKind(k);
              if (k !== "set" && (entity === "person" || entity === "car" || entity === "settings")) changeEntity("income");
            }}
            options={[
              { value: "set", label: "Wert setzen" },
              { value: "enable", label: "Eintrag einschalten" },
              { value: "disable", label: "Eintrag ausschalten" },
            ]}
          />
        </Field>
        <Field label="Bereich">
          <Select
            aria-label="Bereich"
            value={entity}
            onChange={(v) => changeEntity(v as SetEntity)}
            options={entities.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))}
          />
        </Field>
      </div>
      {entity !== "settings" && (
        <Field label="Eintrag">
          <Select
            aria-label="Eintrag"
            value={targetId}
            onChange={(v) => {
              setTargetId(v);
              setValue(null);
            }}
            placeholder="Keine Einträge"
            disabled={items.length === 0}
            options={items.map((i) => ({ value: i.id, label: i.name || "(ohne Namen)" }))}
          />
        </Field>
      )}
      {kind === "set" && (
        <div className="row2">
          {entity === "person" ? (
            <Field label="Wert">
              <Select
                aria-label="Wert"
                value={personField}
                onChange={(v) => {
                  setPersonField(v as typeof personField);
                  setValue(null);
                }}
                options={Object.entries(PERSON_FIELD_LABEL).map(([k, v]) => ({ value: k, label: v }))}
              />
            </Field>
          ) : entity === "settings" ? (
            <Field label="Einstellung">
              <Select
                aria-label="Einstellung"
                value={settingsField}
                onChange={(v) => {
                  setSettingsField(v as typeof settingsField);
                  setValue(null);
                }}
                options={settingsFields.map(([k, v]) => ({ value: k, label: v }))}
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Neuer Wert" hint={current != null ? `jetzt ${isMoney ? formatEur(current) : current}` : undefined}>
            <NumberInput
              key={`${entity}:${targetId}:${personField}:${settingsField}`}
              className="field num"
              label="Neuer Wert"
              value={effectiveValue}
              decimals={isMoney ? 2 : 3}
              suffix={isMoney ? "€" : ""}
              onChange={(v) => setValue(v)}
            />
          </Field>
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="btn p" onClick={submit} disabled={entity !== "settings" && !targetId}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
