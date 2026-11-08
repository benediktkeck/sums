"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { Car as CarIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { commuteFuelCost } from "@sums/core/engine/calculate";
import { formatEur, formatNumber } from "@sums/core/format";
import { newId, removeCar } from "@sums/core/model/ops";
import type { Car } from "@sums/core/model/schema";
import { Select } from "@/components/ui/select";
import { SettingsHeader } from "../settings-shell";
import { usePlan } from "../plan-provider";
import { Field, NumberInput, useNewItemShortcut } from "../ui-bits";

export function CarsView() {
  const { plan, result, update, undo } = usePlan();

  const setField = <K extends keyof Car>(c: Car, key: K, value: Car[K], summary: string) =>
    update(
      (d) => {
        d.cars = d.cars.map((x) => (x.id === c.id ? { ...x, [key]: value } : x));
      },
      { summary, coalesceKey: `car:${c.id}:${String(key)}` },
    );

  const add = () => {
    const name = plan.cars.length === 0 ? "Auto" : `Auto ${plan.cars.length + 1}`;
    update((d) => void d.cars.push({ id: newId("car"), name, consumption: 6, fuelType: "e10" }), { summary: `Neues Auto „${name}“` });
  };
  useNewItemShortcut(add);

  return (
    <>
      <SettingsHeader
        title="Autos"
        lead="Verbrauch und Kraftstoff gelten für alle, die das Auto fahren. Teilt ihr euch eins, wählt es unter Personen bei beiden aus."
        action={
          <button className="btn p" onClick={add}>
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neues Auto</span>
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {plan.cars.map((c) => {
          const eff = result.effective.cars.find((x) => x.id === c.id) ?? c;
          const drivers = result.effective.persons.filter((p) => p.carId === c.id);
          const cost = drivers.reduce((sum, p) => sum + commuteFuelCost(p, eff, result.effective.settings), 0);
          const override = result.overrides[`car:${c.id}:consumption`];
          return (
            <section className="card" key={c.id}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 flex-none place-items-center rounded-full bg-hover text-fg-3">
                  <CarIcon size={18} />
                </span>
                <input {...NO_AUTOFILL}
                  className="field flex-1 !text-[17px] font-semibold"
                  aria-label="Name"
                  value={c.name}
                  onChange={(e) => setField(c, "name", e.target.value, `Auto „${e.target.value}“ umbenannt`)}
                />
                <button
                  className="btn ibtn ghost danger"
                  aria-label={`${c.name} löschen`}
                  title="Löschen"
                  onClick={() => {
                    update((d) => removeCar(d, c.id), { summary: `Auto „${c.name}“ gelöscht` });
                    toast(`„${c.name}“ gelöscht`, { action: { label: "Rückgängig", onClick: () => void undo() } });
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              <div className="row2">
                <Field label="Verbrauch" hint={override ? `Szenario: ${formatNumber(eff.consumption)}` : undefined}>
                  <NumberInput
                    className="field num"
                    label="Verbrauch"
                    value={c.consumption}
                    decimals={2}
                    suffix="l/100 km"
                    min={0}
                    onChange={(v, s) => setField(c, "consumption", v, `Verbrauch ${c.name} ${formatNumber(s)} → ${formatNumber(v)} l`)}
                  />
                </Field>
                <Field label="Kraftstoff">
                  <Select
                    aria-label="Kraftstoff"
                    value={c.fuelType}
                    onChange={(v) => setField(c, "fuelType", v as Car["fuelType"], `Kraftstoff ${c.name}: ${v === "diesel" ? "Diesel" : "E10"}`)}
                    options={[
                      { value: "e10", label: "Benzin E10", hint: `${formatNumber(plan.settings.fuelPriceE10, 3)} €/l` },
                      { value: "diesel", label: "Diesel", hint: `${formatNumber(plan.settings.fuelPriceDiesel, 3)} €/l` },
                    ]}
                  />
                </Field>
              </div>
              <p className="note">
                {drivers.length ? (
                  <>
                    Gefahren von {drivers.map((p) => p.name).join(" und ")} · Tankkosten: <b className="n text-fg">{formatEur(cost)}</b> pro Monat
                  </>
                ) : (
                  "Noch niemandem zugeordnet."
                )}
              </p>
            </section>
          );
        })}
        {plan.cars.length === 0 && <div className="card text-fg-2">Noch keine Autos. Lege mit „Neues Auto“ eins an und ordne es unter Personen zu.</div>}
      </div>
    </>
  );
}
