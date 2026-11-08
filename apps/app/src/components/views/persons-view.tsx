"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { carOf, commuteFuelCost, fuelPrice } from "@sums/core/engine/calculate";
import { formatEur, formatNumber } from "@sums/core/format";
import { addPerson, removePerson } from "@sums/core/model/ops";
import type { Person } from "@sums/core/model/schema";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select } from "@/components/ui/select";
import { SettingsHeader } from "../settings-shell";
import { usePlan } from "../plan-provider";
import { Field, NumberInput, useNewItemShortcut } from "../ui-bits";

export function PersonsView() {
  const { plan, result, update, undo } = usePlan();

  const setField = <K extends keyof Person>(p: Person, key: K, value: Person[K], summary: string) =>
    update(
      (d) => {
        d.persons = d.persons.map((x) => (x.id === p.id ? { ...x, [key]: value } : x));
      },
      { summary, coalesceKey: `person:${p.id}:${String(key)}` },
    );

  const commute = plan.settings.commute;
  const add = () => {
    const name = `Person ${String.fromCharCode(65 + plan.persons.length)}`;
    update((d) => void addPerson(d, name), { summary: `Neue Person „${name}“` });
  };
  useNewItemShortcut(add);

  return (
    <>
      <SettingsHeader
        title="Personen"
        lead={
          commute
            ? "Wer gehört zum Haushalt? Bürotage, Arbeitsweg und das Auto bestimmen die Tankkosten."
            : "Wer gehört zum Haushalt? Einkommen lassen sich Personen zuordnen, und das Freie wird auf sie verteilt."
        }
        action={
          <button className="btn p" onClick={add}>
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neue Person</span>
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {plan.persons.map((p) => {
          const eff = result.effective.persons.find((x) => x.id === p.id) ?? p;
          const car = carOf(result.effective, eff);
          const cost = commuteFuelCost(eff, car, result.effective.settings);
          const ov = (field: string) => result.overrides[`person:${p.id}:${field}`];
          return (
            <section className="card" key={p.id}>
              <div className="flex items-center gap-3">
                <ColorPicker
                  label={`Farbe ${p.name} wählen`}
                  value={p.color}
                  className="size-9 rounded-full"
                  onChange={(c) => setField(p, "color", c, `Farbe ${p.name} geändert`)}
                />
                <input {...NO_AUTOFILL}
                  className="field flex-1 !text-[17px] font-semibold"
                  aria-label="Name"
                  value={p.name}
                  onChange={(e) => setField(p, "name", e.target.value, `Name „${e.target.value}“`)}
                />
                <button
                  className="btn ibtn ghost danger"
                  aria-label={`${p.name} löschen`}
                  title="Löschen"
                  onClick={() => {
                    update((d) => removePerson(d, p.id), { summary: `Person „${p.name}“ gelöscht` });
                    toast(`„${p.name}“ gelöscht`, { action: { label: "Rückgängig", onClick: () => void undo() } });
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              {commute && (
                <>
                  <div className="row2">
                    <Field label="Bürotage pro Woche" hint={ov("officeDaysPerWeek") ? `Szenario: ${formatNumber(eff.officeDaysPerWeek)}` : undefined}>
                      <NumberInput
                        className="field num"
                        label="Bürotage pro Woche"
                        value={p.officeDaysPerWeek}
                        decimals={1}
                        suffix="Tage"
                        min={0}
                        onChange={(v, s) => setField(p, "officeDaysPerWeek", Math.min(7, v), `Bürotage ${p.name} ${formatNumber(s)} → ${formatNumber(v)}`)}
                      />
                    </Field>
                    <Field label="Arbeitsweg (einfach)">
                      <NumberInput
                        className="field num"
                        label="Arbeitsweg"
                        value={p.commuteKm}
                        decimals={1}
                        suffix="km"
                        min={0}
                        onChange={(v, s) => setField(p, "commuteKm", v, `Arbeitsweg ${p.name} ${formatNumber(s)} → ${formatNumber(v)} km`)}
                      />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Auto">
                      <Select
                        aria-label={`Auto von ${p.name}`}
                        value={p.carId ?? ""}
                        options={[{ value: "", label: "Kein Auto" }, ...plan.cars.map((c) => ({ value: c.id, label: c.name || "(ohne Namen)" }))]}
                        onChange={(v) => setField(p, "carId", v || null, `${p.name}: ${plan.cars.find((c) => c.id === v)?.name ?? "kein Auto"}`)}
                      />
                    </Field>
                  </div>
                  <p className="note">
                    {car ? (
                      <>
                        Tankkosten: <b className="n text-fg">{formatEur(cost)}</b> pro Monat ({formatNumber(eff.officeDaysPerWeek)} × 2 ×{" "}
                        {formatNumber(result.effective.settings.weeksPerMonth, 2)} Wo. × {formatNumber(eff.commuteKm)} km ÷ 100 ×{" "}
                        {formatNumber(car.consumption)} l × {formatNumber(fuelPrice(result.effective.settings, car), 3)} €)
                      </>
                    ) : (
                      "Ohne Auto fallen keine Tankkosten an."
                    )}
                  </p>
                </>
              )}
            </section>
          );
        })}
        {plan.persons.length === 0 && (
          <div className="card text-fg-2">Noch keine Personen. Lege mit „Neue Person“ die Mitglieder des Haushalts an.</div>
        )}
      </div>
    </>
  );
}
