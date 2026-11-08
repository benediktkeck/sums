"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEur, formatNumber } from "@sums/core/format";
import { CATEGORY_COLORS } from "@sums/core/model/empty";
import { moveById, newId, removeCategory, removeItem } from "@sums/core/model/ops";
import { DEFAULT_WEEKS_PER_MONTH, type Settings, type SplitMode } from "@sums/core/model/schema";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select } from "@/components/ui/select";
import { SettingsHeader } from "../settings-shell";
import { usePlan } from "../plan-provider";
import { Checkbox, Field, NumberInput, Toggle, useDragReorder } from "../ui-bits";
import { useUi } from "../ui-context";

export function SettingsView() {
  const { plan, result, update, undo } = usePlan();
  const { navIcons, setNavIcons } = useUi();
  const s = plan.settings;
  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K], summary: string) =>
    update(
      (d) => {
        d.settings = { ...d.settings, [key]: value };
      },
      { summary, coalesceKey: `settings:${key}` },
    );
  const drag = useDragReorder((id, target, after) =>
    update((d) => void (d.categories = moveById(d.categories, id, target, after)), { summary: "Reihenfolge der Kategorien geändert" }),
  );
  const exactWeeks = Math.abs(s.weeksPerMonth - DEFAULT_WEEKS_PER_MONTH) < 1e-9;

  const fuelLines = plan.variableCosts.filter((v) => v.kind === "commute-fuel");
  const setCommute = (on: boolean) => {
    update(
      (d) => {
        d.settings = { ...d.settings, commute: on };
        if (on) {
          // Every person gets a fuel line, as when adding a person with the module on.
          for (const p of d.persons) {
            if (!d.variableCosts.some((v) => v.kind === "commute-fuel" && v.personId === p.id)) {
              d.variableCosts.push({ id: newId("var"), label: `Tanken ${p.name}`, kind: "commute-fuel", personId: p.id, active: true, condition: null });
            }
          }
        } else {
          for (const v of d.variableCosts.filter((x) => x.kind === "commute-fuel")) removeItem(d, "variable", v.id);
        }
      },
      { summary: on ? "Fahrtkosten eingeschaltet" : "Fahrtkosten ausgeschaltet" },
    );
    if (!on && fuelLines.length) {
      toast(`Fahrtkosten aus – ${fuelLines.length} Tankkosten-Posten entfernt.`, {
        action: { label: "Rückgängig", onClick: () => void undo() },
      });
    }
  };

  return (
    <>
      <SettingsHeader title="Allgemein" lead="Kategorien, Aufteilung des Freien und Fahrtkosten." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel lg:row-span-2">
          <div className="sec-title">
            Kategorien <small>für Fixkosten · ziehen zum Sortieren</small>
          </div>
          {plan.categories.map((c) => {
            const count = plan.expenses.filter((e) => e.categoryId === c.id).length;
            const rp = drag.rowProps(c.id);
            return (
              <div key={c.id} {...rp} className={`r !grid-cols-[22px_minmax(0,1fr)_auto_28px] ${rp.className}`}>
                {drag.handle(c.id, c.name)}
                <ColorPicker
                  label={`Farbe ${c.name} wählen`}
                  value={c.color}
                  themed={CATEGORY_COLORS}
                  className="size-[20px] rounded-[6px]"
                  onChange={(next) =>
                    update((d) => void (d.categories = d.categories.map((x) => (x.id === c.id ? { ...x, color: next } : x))), {
                      summary: `Farbe „${c.name}“ geändert`,
                      coalesceKey: `category:${c.id}:color`,
                    })
                  }
                />
                <input {...NO_AUTOFILL}
                  className="inp !text-left"
                  aria-label="Kategoriename"
                  value={c.name}
                  onChange={(e) =>
                    update((d) => void (d.categories = d.categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x))), {
                      summary: `Kategorie „${e.target.value}“ umbenannt`,
                      coalesceKey: `category:${c.id}:name`,
                    })
                  }
                />
                <span className="text-[13px] text-fg-3">{count} Einträge</span>
                <button
                  className="menu"
                  aria-label={`${c.name} löschen`}
                  title={count ? "Löschen – Einträge werden „Ohne Kategorie“" : "Löschen"}
                  onClick={() => {
                    update((d) => removeCategory(d, c.id), { summary: `Kategorie „${c.name}“ gelöscht` });
                    if (count) toast(`„${c.name}“ gelöscht – ${count} Einträge sind jetzt ohne Kategorie.`, { action: { label: "Rückgängig", onClick: () => void undo() } });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          <button
            className="addr !pl-4"
            onClick={() =>
              update(
                (d) =>
                  void d.categories.push({
                    id: newId("cat"),
                    name: "Neue Kategorie",
                    color: CATEGORY_COLORS[d.categories.length % CATEGORY_COLORS.length],
                  }),
                { summary: "Neue Kategorie" },
              )
            }
          >
            <Plus size={16} /> Kategorie hinzufügen
          </button>
        </section>

        <section className="card">
          <h2>Taschengeld</h2>
          <div className="row2">
            <Field label="Aufteilung des Freien">
              <Select
                aria-label="Aufteilung des Freien"
                value={s.splitMode}
                options={SPLIT_OPTIONS}
                onChange={(v) => setSetting("splitMode", v as SplitMode, `Aufteilung: ${SPLIT_LABEL[v as SplitMode]}`)}
              />
            </Field>
            {s.splitMode !== "none" && (
              <Field label="Höchstens pro Person">
                <NumberInput
                  className="field num"
                  label="Taschengeld-Obergrenze"
                  value={s.allowanceCap}
                  min={0}
                  onChange={(v, st) => setSetting("allowanceCap", v, `Taschengeld-Obergrenze ${formatEur(st)} → ${formatEur(v)}`)}
                />
              </Field>
            )}
          </div>
          <p className="note">{SPLIT_NOTE[s.splitMode]}</p>
        </section>

        <section className="card">
          <h2>
            Fahrtkosten zur Arbeit
            <Toggle on={s.commute} label="Fahrtkosten zur Arbeit berechnen" onToggle={() => setCommute(!s.commute)} />
          </h2>
          {!s.commute ? (
            <p className="note">
              Aus. Eingeschaltet werden die Tankkosten jeder Person aus Bürotagen, Arbeitsweg, Verbrauch des Autos und Spritpreis berechnet.
            </p>
          ) : (
            <>
              <div className="row2 mt-3">
                <Field label="Benzin E10">
                  <NumberInput
                    className="field num"
                    label="Preis E10"
                    value={s.fuelPriceE10}
                    decimals={3}
                    suffix="€/l"
                    min={0}
                    onChange={(v) => setSetting("fuelPriceE10", v, `Preis E10 → ${formatNumber(v, 3)} €`)}
                  />
                </Field>
                <Field label="Diesel">
                  <NumberInput
                    className="field num"
                    label="Preis Diesel"
                    value={s.fuelPriceDiesel}
                    decimals={3}
                    suffix="€/l"
                    min={0}
                    onChange={(v) => setSetting("fuelPriceDiesel", v, `Preis Diesel → ${formatNumber(v, 3)} €`)}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="Wochen pro Monat">
                  <NumberInput
                    className="field num"
                    label="Wochen pro Monat"
                    value={s.weeksPerMonth}
                    decimals={4}
                    suffix=""
                    min={0.1}
                    onChange={(v) => setSetting("weeksPerMonth", v, `Wochen pro Monat → ${formatNumber(v, 2)}`)}
                  />
                </Field>
                <button className={`chip ${exactWeeks ? "on" : ""} !pr-3`} onClick={() => setSetting("weeksPerMonth", DEFAULT_WEEKS_PER_MONTH, "Wochen pro Monat → 52/12")}>
                  52/12 ≈ 4,33 (genau)
                </button>
              </div>
              <p className="note">
                Bürotage und Arbeitsweg stehen unter{" "}
                <Link href="/einstellungen/personen" className="underline hover:text-brand">
                  Personen
                </Link>
                , Verbrauch und Kraftstoff unter{" "}
                <Link href="/einstellungen/autos" className="underline hover:text-brand">
                  Autos
                </Link>
                . Tankkosten gesamt:{" "}
                <b className="n text-fg">
                  {formatEur(
                    result.effective.variableCosts.filter((v) => v.kind === "commute-fuel").reduce((sum, v) => sum + (result.variable.items[v.id] ?? 0), 0),
                  )}
                </b>{" "}
                pro Monat.
              </p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Darstellung</h2>
          <div className="mt-3 flex items-center gap-3">
            <Checkbox on={navIcons} label="Symbole in der Navigation" onToggle={() => setNavIcons(!navIcons)} />
            <span>Symbole in der Navigation</span>
          </div>
          <p className="note">Gilt nur für diesen Browser.</p>
        </section>

      </div>
    </>
  );
}

const SPLIT_LABEL: Record<SplitMode, string> = {
  equal: "gleich",
  income: "nach Einkommen",
  none: "kein Taschengeld",
};

const SPLIT_OPTIONS = [
  { value: "equal", label: "Gleich für alle", hint: "Jede Person bekommt denselben Anteil" },
  { value: "income", label: "Nach Einkommen", hint: "Wer mehr verdient, bekommt mehr" },
  { value: "none", label: "Kein Taschengeld", hint: "Alles Freie bleibt Überschuss" },
];

const SPLIT_NOTE: Record<SplitMode, string> = {
  equal: "Das Freie wird gleichmäßig auf alle Personen verteilt, höchstens bis zur Obergrenze. Der Rest ist Überschuss.",
  income:
    "Jede Person bekommt einen Anteil im Verhältnis zu ihrem Einkommen (Einkommen ohne Person zählen nicht mit), höchstens bis zur Obergrenze. Der Rest ist Überschuss.",
  none: "Es wird kein Taschengeld abgezogen. Alles Freie ist Überschuss.",
};
