"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, PiggyBank, Plus, Repeat } from "lucide-react";
import { INTERVAL_DIVISOR } from "@sums/core/engine/calculate";
import { formatEur } from "@sums/core/format";
import { INTERVAL_LABEL, moveById, newId, removeItem, sortExpenses, type ExpenseSort } from "@sums/core/model/ops";
import { savingsPresets } from "@/lib/onboarding";
import { SectionIntro } from "../onboarding/section-intro";
import { SavingsDialog } from "../dialogs";
import { ExpenseCols } from "../expense-cols";
import { PageGrid, PageHeader, Wrap } from "../page";
import { usePlan } from "../plan-provider";
import { CatDot, IntervalTag } from "../select-options";
import { Tip, useNewItemShortcut, ValueCell } from "../ui-bits";
import { SimpleList } from "./simple-list";

export function SavingsView() {
  const { plan, result, update } = usePlan();
  const [dialog, setDialog] = useState<{ id: string | null; preset?: { name: string } } | null>(null);
  useNewItemShortcut(() => setDialog({ id: null }));

  const [showPeriodic, setShowPeriodic] = useState(true);
  const [sort, setSort] = useState<ExpenseSort | null>(null);
  const periodicItems = sortExpenses(
    result.effective.expenses
      .filter((e) => e.interval !== "monthly" && result.expenses[e.id]?.status.active)
      .sort((a, b) => INTERVAL_DIVISOR[b.interval] - INTERVAL_DIVISOR[a.interval]),
    sort,
    (e) => result.expenses[e.id].monthly,
  );

  const categoryColor = (id: string | null) => plan.categories.find((c) => c.id === id)?.color ?? "var(--fg-3)";

  const accountLabel = (id: string | null) => {
    const a = plan.accounts.find((x) => x.id === id);
    return a ? (
      <span className="flex items-center gap-1.5">
        <span className="size-2 flex-none rounded-full" style={{ background: a.color }} />
        <span className="truncate">{a.name}</span>
      </span>
    ) : undefined;
  };
  const rows = plan.savings.map((s) => ({
    id: s.id,
    name: s.name,
    detail: accountLabel(s.accountId),
    ownActive: s.active,
    status: result.status.savings[s.id],
    override: result.overrides[`savings:${s.id}:amount`],
    amount: s.amount,
    effective: result.savings.items[s.id] ?? 0,
    raw: result.savings.raw[s.id] ?? 0,
  }));

  return (
    <Wrap>
      <PageHeader
        title="Rücklagen"
        lead={
          <>
            <b className="n">{formatEur(result.savings.total)}</b> pro Monat · davon <b className="n">{formatEur(result.periodic)}</b> für
            Jahreszahlungen
          </>
        }
        action={
          <button className="btn p" onClick={() => setDialog({ id: null })} title="Neue Rücklage (N)">
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neue Rücklage</span>
          </button>
        }
      />
      <PageGrid>
        <div className="grid gap-4">
          <section className="panel">
            <div className="ov-head !bg-raised">
              <PiggyBank size={17} className="ov-icon" />
              <span className="ov-title">Eigene Rücklagen</span>
              <span className="sp" />
              <span className="ov-total n">{formatEur(result.savings.total - result.periodic)}</span>
              <span className="text-[13px] text-fg-3">/ Monat</span>
            </div>
            {rows.length === 0 && (
              <SectionIntro
                step="savings"
                icon={PiggyBank}
                title="Was legst du jeden Monat zur Seite?"
                tips={[
                  <>Ein fester Betrag pro Monat, zum Beispiel per Dauerauftrag aufs Tagesgeld.</>,
                  <>
                    Jahreszahlungen aus den Fixkosten musst du hier <b>nicht</b> eintragen – die stehen unten unter „Periodische Ausgaben“ und werden
                    automatisch angespart.
                  </>,
                ]}
                examples={savingsPresets(plan).map((p) => ({ key: p.name, label: p.name, onPick: () => setDialog({ id: null, preset: { name: p.name } }) }))}
                onAdd={() => setDialog({ id: null })}
                addLabel="Eigene Rücklage"
              >
                Sparen mit Ziel: ein Notgroschen für Unvorhergesehenes, Urlaub, die nächste größere Anschaffung.
              </SectionIntro>
            )}
            {rows.length > 0 && <SimpleList
              rows={rows}
              detailHeader="Sparkonto"
              onToggle={(r) =>
                update(
                  (d) => {
                    d.savings = d.savings.map((i) => (i.id === r.id ? { ...i, active: !i.active } : i));
                  },
                  { summary: `Rücklage „${r.name}“ ${r.ownActive ? "aus" : "ein"}geschaltet` },
                )
              }
              onAmount={(r, v, s) =>
                update(
                  (d) => {
                    d.savings = d.savings.map((i) => (i.id === r.id ? { ...i, amount: v } : i));
                  },
                  { summary: `Rücklage ${r.name} ${formatEur(s)} → ${formatEur(v)}`, coalesceKey: `savings:${r.id}:amount` },
                )
              }
              onEdit={(r) => setDialog({ id: r.id })}
              onDelete={(r) => update((d) => removeItem(d, "savings", r.id), { summary: `Rücklage „${r.name}“ gelöscht` })}
              onMove={(id, target, after) => update((d) => void (d.savings = moveById(d.savings, id, target, after)), { summary: "Reihenfolge geändert" })}
              onDuplicate={(r) =>
                update(
                  (d) => {
                    const i = d.savings.findIndex((x) => x.id === r.id);
                    d.savings.splice(i + 1, 0, { ...d.savings[i], id: newId("sav"), name: `${r.name} (Kopie)` });
                  },
                  { summary: `Rücklage „${r.name}“ dupliziert` },
                )
              }
            />}
            {rows.length > 0 && (
              <button className="addr" onClick={() => setDialog({ id: null })}>
                + Rücklage hinzufügen
              </button>
            )}
          </section>

          <section className="panel">
            <div className="ov-head !bg-raised">
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                onClick={() => setShowPeriodic(!showPeriodic)}
                aria-expanded={showPeriodic}
              >
                <ChevronDown size={16} strokeWidth={2.5} className={`flex-none text-fg-3 transition ${showPeriodic ? "" : "-rotate-90"}`} />
                <Repeat size={17} className="ov-icon" />
                <span className="ov-title truncate">Periodische Ausgaben</span>
                <Tip content="Wird automatisch aus allen nicht-monatlichen Fixkosten berechnet">
                  <span className="tag hide-m !h-[22px]">automatisch</span>
                </Tip>
              </button>
              <span className="ov-total n">{formatEur(result.periodic)}</span>
              <span className="hide-m text-[13px] text-fg-3">/ Monat</span>
              <Tip content="In Fixkosten bearbeiten">
                <Link href="/fixkosten" className="menu" aria-label="In Fixkosten bearbeiten">
                  <ArrowUpRight size={16} />
                </Link>
              </Tip>
            </div>
            {showPeriodic && (
              <>
                <ExpenseCols sort={sort} onSort={setSort} />
                {periodicItems.map((e) => (
                  <div className="r r-exp" key={e.id}>
                    <span className="grid place-items-center">
                      <CatDot color={categoryColor(e.categoryId)} />
                    </span>
                    <Link href="/fixkosten" className="nm">
                      <span>{e.name}</span>
                      {e.provider && <small className="pvs m-sub">{e.provider}</small>}
                    </Link>
                    <span className="pvc cursor-default">{e.provider || <span className="opacity-40">–</span>}</span>
                    <span className="selc ivc">
                      <IntervalTag interval={e.interval} />
                      {INTERVAL_LABEL[e.interval]}
                    </span>
                    <span className="inpc n rt text-fg-2">{formatEur(e.amount)}</span>
                    <ValueCell value={result.expenses[e.id].monthly} active reserve />
                    <span className="hide-m" />
                  </div>
                ))}
                {periodicItems.length === 0 && <div className="empty">Keine Jahres-, Halbjahres- oder Quartalszahlungen</div>}
              </>
            )}
          </section>
        </div>
      </PageGrid>
      {dialog && <SavingsDialog id={dialog.id} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </Wrap>
  );
}
