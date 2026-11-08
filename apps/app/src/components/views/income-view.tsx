"use client";

import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { formatEur } from "@sums/core/format";
import { moveById, newId, removeItem } from "@sums/core/model/ops";
import type { Income } from "@sums/core/model/schema";
import { incomePresets } from "@/lib/onboarding";
import { SectionIntro } from "../onboarding/section-intro";
import { IncomeDialog } from "../dialogs";
import { PageGrid, PageHeader, Wrap } from "../page";
import { usePlan } from "../plan-provider";
import { useNewItemShortcut } from "../ui-bits";
import { SimpleList } from "./simple-list";

export function IncomeView() {
  const { plan, result, update } = usePlan();
  const [dialog, setDialog] = useState<{ id: string | null; preset?: Partial<Pick<Income, "label" | "personId">> } | null>(null);
  useNewItemShortcut(() => setDialog({ id: null }));

  const personLabel = (id: string | null) => {
    const p = plan.persons.find((x) => x.id === id);
    return p ? (
      <span className="flex items-center gap-1.5">
        <span className="size-2 flex-none rounded-full" style={{ background: p.color }} />
        <span className="truncate">{p.name}</span>
      </span>
    ) : undefined;
  };
  const rows = plan.incomes.map((i) => ({
    id: i.id,
    name: i.label,
    detail: personLabel(i.personId),
    ownActive: i.active,
    status: result.status.income[i.id],
    override: result.overrides[`income:${i.id}:amount`],
    amount: i.amount,
    effective: result.income.items[i.id] ?? 0,
    raw: result.income.raw[i.id] ?? 0,
  }));

  return (
    <Wrap>
      <PageHeader
        title="Einkommen"
        lead={
          <>
            <b className="n">{formatEur(result.income.total)}</b> netto pro Monat
            {plan.persons.length > 0 && (
              <>
                {" · "}
                {plan.persons
                  .map((p) => {
                    const sum = result.effective.incomes
                      .filter((i) => i.personId === p.id)
                      .reduce((s, i) => s + (result.income.items[i.id] ?? 0), 0);
                    return `${p.name} ${formatEur(sum)}`;
                  })
                  .join(" · ")}
              </>
            )}
          </>
        }
        action={
          <button className="btn p" onClick={() => setDialog({ id: null })} title="Neues Einkommen (N)">
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neues Einkommen</span>
          </button>
        }
      />
      <PageGrid>
        <section className="panel">
          {rows.length === 0 && (
            <SectionIntro
              step="income"
              icon={Wallet}
              title="Was kommt jeden Monat rein?"
              tips={[
                <>
                  <b>Netto</b>, also was wirklich auf dem Konto ankommt – pro Monat.
                </>,
                <>Weihnachts- oder Urlaubsgeld: Jahresbetrag durch 12 teilen.</>,
                plan.persons.length > 1 ? <>Ordne jedes Einkommen einer Person zu – danach richtet sich die Aufteilung, wenn ihr nach Einkommen teilt.</> : null,
              ].filter(Boolean)}
              examples={incomePresets(plan).map((p) => ({ key: p.name, label: p.name, trackAs: p.personId ? "Gehalt" : p.name, onPick: () => setDialog({ id: null, preset: { label: p.name, personId: p.personId } }) }))}
              onAdd={() => setDialog({ id: null })}
              addLabel="Eigenes Einkommen"
            >
              Gehalt, Rente, Kindergeld, Nebenjob – alles, was regelmäßig reinkommt. Das ist der Startpunkt: davon wird alles Weitere abgezogen.
            </SectionIntro>
          )}
          {rows.length > 0 && <SimpleList
            rows={rows}
            detailHeader="Person"
            onToggle={(r) =>
              update(
                (d) => {
                  d.incomes = d.incomes.map((i) => (i.id === r.id ? { ...i, active: !i.active } : i));
                },
                { summary: `Einkommen „${r.name}“ ${r.ownActive ? "aus" : "ein"}geschaltet` },
              )
            }
            onAmount={(r, v, s) =>
              update(
                (d) => {
                  d.incomes = d.incomes.map((i) => (i.id === r.id ? { ...i, amount: v } : i));
                },
                { summary: `Einkommen ${r.name} ${formatEur(s)} → ${formatEur(v)}`, coalesceKey: `income:${r.id}:amount` },
              )
            }
            onEdit={(r) => setDialog({ id: r.id })}
            onDelete={(r) => update((d) => removeItem(d, "income", r.id), { summary: `Einkommen „${r.name}“ gelöscht` })}
            onMove={(id, target, after) => update((d) => void (d.incomes = moveById(d.incomes, id, target, after)), { summary: "Reihenfolge geändert" })}
            onDuplicate={(r) =>
              update(
                (d) => {
                  const i = d.incomes.findIndex((x) => x.id === r.id);
                  d.incomes.splice(i + 1, 0, { ...d.incomes[i], id: newId("inc"), label: `${r.name} (Kopie)` });
                },
                { summary: `Einkommen „${r.name}“ dupliziert` },
              )
            }
          />}
          {rows.length > 0 && (
            <button className="addr" onClick={() => setDialog({ id: null })}>
              + Einkommen hinzufügen
            </button>
          )}
        </section>
      </PageGrid>
      {dialog && <IncomeDialog id={dialog.id} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </Wrap>
  );
}
