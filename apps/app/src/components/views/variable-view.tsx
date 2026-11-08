"use client";

import Link from "next/link";
import { useState } from "react";
import { Fuel, Plus, ShoppingCart } from "lucide-react";
import { carOf } from "@sums/core/engine/calculate";
import { formatEur, formatNumber } from "@sums/core/format";
import { moveById, newId, removeItem } from "@sums/core/model/ops";
import { variablePresets } from "@/lib/onboarding";
import { SectionIntro } from "../onboarding/section-intro";
import { VariableDialog } from "../dialogs";
import { PageGrid, PageHeader, Wrap } from "../page";
import { usePlan } from "../plan-provider";
import { useNewItemShortcut } from "../ui-bits";
import { SimpleList } from "./simple-list";

export function VariableView() {
  const { plan, result, update } = usePlan();
  const [dialog, setDialog] = useState<{ id: string | null; preset?: { label: string } } | null>(null);
  useNewItemShortcut(() => setDialog({ id: null }));
  const eff = result.effective;

  const rows = plan.variableCosts.map((v) => {
    const person = v.kind === "commute-fuel" ? eff.persons.find((p) => p.id === v.personId) : undefined;
    const car = person && carOf(eff, person);
    const carText = car ? `${car.name} · ${formatNumber(car.consumption)} l · ${car.fuelType === "diesel" ? "Diesel" : "E10"}` : "kein Auto";
    return {
      id: v.id,
      name: v.label,
      detail: person
        ? `${formatNumber(person.officeDaysPerWeek)} Tage · ${formatNumber(person.commuteKm)} km · ${carText}`
        : v.kind === "commute-fuel"
          ? "Person fehlt"
          : "Fester Betrag",
      detailLink: person ? { href: "/einstellungen/personen", title: "Bürotage und Arbeitsweg unter Personen ändern" } : undefined,
      ownActive: v.active,
      status: result.status.variable[v.id],
      override: result.overrides[`variable:${v.id}:amount`],
      amount: v.kind === "fixed" ? v.amount : undefined,
      effective: result.variable.items[v.id] ?? 0,
      raw: result.variable.raw[v.id] ?? 0,
    };
  });

  return (
    <Wrap>
      <PageHeader
        title="Variable Kosten"
        lead={
          <>
            <b className="n">{formatEur(result.variable.total)}</b> pro Monat · {eff.settings.commute ? "Tanken, Lebensmittel" : "Lebensmittel, Freizeit"} und andere schwankende Ausgaben
          </>
        }
        action={
          <button className="btn p" onClick={() => setDialog({ id: null })} title="Neue variable Kosten (N)">
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neuer Eintrag</span>
          </button>
        }
      />
      <PageGrid>
        <section className="panel">
          {rows.length === 0 && (
            <SectionIntro
              step="variable"
              icon={ShoppingCart}
              title="Was schwankt von Monat zu Monat?"
              tips={[
                <>Schätze einen <b>Monatsdurchschnitt</b>. Die Banking-App zeigt oft, wie viel du z. B. im Supermarkt ausgibst.</>,
                <>Lieber etwas großzügiger planen – was übrig bleibt, landet im Überschuss.</>,
                ...(eff.settings.commute ? [<>Mit der Art „Tankkosten Arbeitsweg“ wird der Sprit aus Bürotagen, Kilometern und Verbrauch berechnet.</>] : []),
              ]}
              examples={variablePresets(plan).map((p) => ({ key: p.name, label: p.name, onPick: () => setDialog({ id: null, preset: { label: p.name } }) }))}
              onAdd={() => setDialog({ id: null })}
              addLabel="Eigener Eintrag"
            >
              Ausgaben ohne festen Vertrag: Lebensmittel, Drogerie, Freizeit. Sie ändern sich jeden Monat, gehören aber trotzdem in den Plan.
            </SectionIntro>
          )}
          {rows.length > 0 && <SimpleList
            rows={rows}
            detailHeader="Grundlage"
            onToggle={(r) =>
              update(
                (d) => {
                  d.variableCosts = d.variableCosts.map((i) => (i.id === r.id ? { ...i, active: !i.active } : i));
                },
                { summary: `„${r.name}“ ${r.ownActive ? "aus" : "ein"}geschaltet` },
              )
            }
            onAmount={(r, v, s) =>
              update(
                (d) => {
                  d.variableCosts = d.variableCosts.map((i) => (i.id === r.id && i.kind === "fixed" ? { ...i, amount: v } : i));
                },
                { summary: `${r.name} ${formatEur(s)} → ${formatEur(v)}`, coalesceKey: `variable:${r.id}:amount` },
              )
            }
            onEdit={(r) => setDialog({ id: r.id })}
            onDelete={(r) => update((d) => removeItem(d, "variable", r.id), { summary: `„${r.name}“ gelöscht` })}
            onMove={(id, target, after) =>
              update((d) => void (d.variableCosts = moveById(d.variableCosts, id, target, after)), { summary: "Reihenfolge geändert" })
            }
            onDuplicate={(r) =>
              update(
                (d) => {
                  const i = d.variableCosts.findIndex((x) => x.id === r.id);
                  d.variableCosts.splice(i + 1, 0, { ...d.variableCosts[i], id: newId("var"), label: `${r.name} (Kopie)` });
                },
                { summary: `„${r.name}“ dupliziert` },
              )
            }
          />}
          {rows.length > 0 && (
            <button className="addr" onClick={() => setDialog({ id: null })}>
              + Eintrag hinzufügen
            </button>
          )}
          {eff.settings.commute && (
            <div className="legend !gap-2">
              <Link href="/einstellungen" className="tag n hover:!text-brand">
                <Fuel size={12} className="mr-1.5" />
                E10 {formatNumber(eff.settings.fuelPriceE10, 3)} €
              </Link>
              <Link href="/einstellungen" className="tag n hover:!text-brand">
                <Fuel size={12} className="mr-1.5" />
                Diesel {formatNumber(eff.settings.fuelPriceDiesel, 3)} €
              </Link>
              <Link href="/einstellungen" className="tag n hover:!text-brand">
                {formatNumber(eff.settings.weeksPerMonth, 2)} Wochen / Monat
              </Link>
            </div>
          )}
        </section>
      </PageGrid>
      {dialog && <VariableDialog id={dialog.id} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </Wrap>
  );
}
