"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, PiggyBank, Plus, Receipt, Search, X } from "lucide-react";
import { INTERVAL_DIVISOR, NO_CATEGORY } from "@sums/core/engine/calculate";
import { formatEur, formatPercent } from "@sums/core/format";
import { INTERVAL_LABEL, INTERVALS, moveById, newId, removeItem, sortExpenses, type ExpenseSort } from "@sums/core/model/ops";
import type { Expense, Interval } from "@sums/core/model/schema";
import { expensePresets } from "@/lib/onboarding";
import { SectionIntro } from "../onboarding/section-intro";
import { ExpenseDialog } from "../dialogs";
import { ExpenseCols } from "../expense-cols";
import { PageGrid, PageHeader, Wrap } from "../page";
import { Select } from "@/components/ui/select";
import { usePlan } from "../plan-provider";
import { INTERVAL_OPTIONS, IntervalTag } from "../select-options";
import { Checkbox, CompositionBar, NumberInput, RowMenu, ScenarioToggle, Tip, useDragReorder, useLocalStorageSet, useNewItemShortcut, ValueCell } from "../ui-bits";

type Mode = "category" | "interval" | "all";
type Group = { key: string; name: string; color: string; items: Expense[]; categoryId?: string | null; interval?: Interval };

function swap<T>(arr: T[], i: number, j: number): T[] {
  const c = arr.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function ExpensesView() {
  const { plan, result, update } = usePlan();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("category");
  const [sort, setSort] = useState<ExpenseSort | null>(null);
  const [collapsed, toggleCollapsed] = useLocalStorageSet("sums:collapsed");
  const [dialog, setDialog] = useState<{
    id: string | null;
    categoryId?: string | null;
    preset?: Partial<Pick<Expense, "name" | "categoryId" | "interval">>;
  } | null>(null);
  const empty = plan.expenses.length === 0;

  useNewItemShortcut(() => setDialog({ id: null }));

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const found = q ? plan.expenses.filter((e) => `${e.name} ${e.provider} ${e.notes}`.toLowerCase().includes(q)) : plan.expenses;
    return sortExpenses(found, sort, (e) => result.expenses[e.id]?.monthly ?? 0);
  }, [plan.expenses, q, sort, result.expenses]);

  const groups: Group[] = useMemo(() => {
    if (mode === "all") return [{ key: "all", name: "Alle Ausgaben", color: "var(--fg-3)", items: visible }];
    if (mode === "interval") {
      return INTERVALS.map((i) => ({
        key: `int:${i}`,
        name: INTERVAL_LABEL[i],
        color: i === "monthly" ? "var(--s-fixed)" : "var(--sav)",
        interval: i,
        items: visible.filter((e) => e.interval === i),
      })).filter((g) => g.items.length > 0 || !q);
    }
    const known = new Set(plan.categories.map((c) => c.id));
    const gs: Group[] = plan.categories.map((c) => ({
      key: c.id,
      name: c.name,
      color: c.color,
      categoryId: c.id,
      items: visible.filter((e) => e.categoryId === c.id),
    }));
    const orphans = visible.filter((e) => !e.categoryId || !known.has(e.categoryId));
    if (orphans.length) gs.push({ key: NO_CATEGORY, name: "Ohne Kategorie", color: "var(--fg-3)", categoryId: null, items: orphans });
    return q ? gs.filter((g) => g.items.length > 0) : gs;
  }, [mode, visible, plan.categories, q]);

  const drag = useDragReorder((dragId, targetId, after) => {
    const target = plan.expenses.find((e) => e.id === targetId);
    const dragged = plan.expenses.find((e) => e.id === dragId);
    if (!target || !dragged) return;
    const moveCategory = mode === "category" && dragged.categoryId !== target.categoryId;
    const catName = plan.categories.find((c) => c.id === target.categoryId)?.name ?? "Ohne Kategorie";
    update(
      (d) => {
        d.expenses = moveById(d.expenses, dragId, targetId, after);
        if (moveCategory) d.expenses = d.expenses.map((e) => (e.id === dragId ? { ...e, categoryId: target.categoryId } : e));
      },
      { summary: moveCategory ? `„${dragged.name}“ nach „${catName}“ verschoben` : "Reihenfolge geändert" },
    );
  });

  const setField = <K extends keyof Expense>(id: string, key: K, value: Expense[K], summary: string, coalesce = false) =>
    update(
      (d) => {
        d.expenses = d.expenses.map((e) => (e.id === id ? { ...e, [key]: value } : e));
      },
      { summary, coalesceKey: coalesce ? `expense:${id}:${String(key)}` : undefined },
    );

  const moveWithin = (group: Group, idx: number, dir: -1 | 1) => {
    const a = group.items[idx];
    const b = group.items[idx + dir];
    if (!a || !b) return;
    update(
      (d) => {
        d.expenses = swap(
          d.expenses,
          d.expenses.findIndex((e) => e.id === a.id),
          d.expenses.findIndex((e) => e.id === b.id),
        );
      },
      { summary: "Reihenfolge geändert" },
    );
  };

  const groupTotal = (g: Group) => {
    let fixed = 0;
    let reserve = 0;
    for (const e of g.items) {
      const r = result.expenses[e.id];
      if (!r?.status.active) continue;
      if (r.bucket === "fixed") fixed += r.monthly;
      else reserve += r.monthly;
    }
    return { fixed, reserve };
  };

  return (
    <Wrap>
      <PageHeader
        title="Fixkosten"
        action={
          <button className="btn p" onClick={() => setDialog({ id: null })} title="Neue Ausgabe (N)">
            <Plus strokeWidth={2.4} />
            <span className="hide-m">Neue Ausgabe</span>
          </button>
        }
      />
      <PageGrid>
        {empty && (
          <section className="panel">
            <SectionIntro
              step="fixed"
              icon={Receipt}
              title="Was geht regelmäßig vom Konto ab?"
              tips={[
                <>Am einfachsten: Kontoauszüge der letzten Monate danebenlegen und Abbuchung für Abbuchung durchgehen.</>,
                <>
                  Zahlst du etwas <b>jährlich oder quartalsweise</b>? Trag den vollen Betrag mit dem passenden Turnus ein – der Monatsanteil wird
                  automatisch in den Rücklagen angespart.
                </>,
                <>Die Kategorien (Wohnung, Versicherung, …) kannst du in den Einstellungen umbenennen und ergänzen.</>,
              ]}
              examples={expensePresets(plan).map((p) => ({
                key: p.name,
                label: p.name,
                onPick: () => setDialog({ id: null, preset: { name: p.name, categoryId: p.categoryId, interval: p.interval } }),
              }))}
              onAdd={() => setDialog({ id: null })}
              addLabel="Eigene Ausgabe"
            >
              Verträge und Abbuchungen mit festem Betrag: Miete, Strom, Versicherungen, Kredite, Abos.
            </SectionIntro>
          </section>
        )}
        {!empty && <FixedStats />}
        {!empty && <section className="panel">
          <div className="tools">
            <label className="search">
              <Search size={18} />
              <input {...NO_AUTOFILL}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen, z. B. „Versicherung“ oder „Telekom“"
                aria-label="Ausgaben durchsuchen"
              />
            </label>
            <div className="seg hide-m" role="tablist" aria-label="Gruppierung">
              {(
                [
                  ["category", "Nach Kategorie"],
                  ["interval", "Nach Turnus"],
                  ["all", "Alle"],
                ] as const
              ).map(([m, label]) => (
                <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "a" : ""} onClick={() => setMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            {sort && (
              <button className="btn ghost !h-8" onClick={() => setSort(null)} title="Sortierung aufheben, Zeilen lassen sich wieder verschieben">
                <X /> Manuelle Reihenfolge
              </button>
            )}
          </div>
          <ExpenseCols sort={sort} onSort={setSort} />

          {groups.map((g) => {
            const isClosed = !q && mode !== "all" && collapsed.has(g.key);
            const off = g.items.filter((e) => !result.expenses[e.id]?.status.active).length;
            const tot = groupTotal(g);
            return (
              <div key={g.key}>
                {mode !== "all" && (
                  <div className={`gh ${isClosed ? "closed" : ""}`}>
                    <button className="gh-t" onClick={() => toggleCollapsed(g.key)} aria-expanded={!isClosed}>
                      <span className="gh-mark">
                        <span className="cdot" style={{ background: g.color }} />
                      </span>
                      <b>{g.name}</b>
                      <span className="cnt">
                        {g.items.length} {g.items.length === 1 ? "Eintrag" : "Einträge"}
                        {off > 0 && ` · ${off} aus`}
                      </span>
                      <ChevronDown className="chev" size={16} strokeWidth={2.5} />
                      <span className="sp" />
                      <span className="tot n">
                        {tot.fixed > 0 && tot.reserve > 0 && (
                          <Tip content="Monatsanteil der Jahreszahlungen in dieser Gruppe, wandert in die Rücklagen">
                            <small className="gh-res">
                              <PiggyBank size={13} strokeWidth={2.2} />
                              {formatEur(tot.reserve)}
                            </small>
                          </Tip>
                        )}
                        {g.interval && g.interval !== "monthly" ? (
                          <b className="tot-v text-sav">
                            <PiggyBank size={14} strokeWidth={2.2} />
                            {formatEur(tot.reserve)}
                          </b>
                        ) : (
                          <b className="tot-v">{formatEur(tot.fixed)}</b>
                        )}
                      </span>
                    </button>
                    {mode === "category" && !q ? (
                      <button
                        className="gh-add"
                        onClick={() => setDialog({ id: null, categoryId: g.categoryId ?? null })}
                        aria-label={`Ausgabe zu „${g.name}“ hinzufügen`}
                        title={`Ausgabe zu „${g.name}“ hinzufügen`}
                      >
                        <Plus size={16} strokeWidth={2.4} />
                      </button>
                    ) : (
                      <span className="gh-add" aria-hidden />
                    )}
                  </div>
                )}
                {!isClosed && (
                  <>
                    {g.items.map((e, idx) => {
                      const r = result.expenses[e.id];
                      const st = r?.status;
                      const active = st?.active ?? e.active;
                      const reserve = e.interval !== "monthly";
                      const override = result.overrides[`expense:${e.id}:amount`];
                      const cat = plan.categories.find((c) => c.id === e.categoryId);
                      const rowProps = sort ? { className: "group relative" } : drag.rowProps(e.id);
                      return (
                        <div key={e.id} {...rowProps} className={`r r-exp ${active ? "" : "off"} ${st?.reason || override ? "scen" : ""} ${rowProps.className}`}>
                          {!sort && drag.handle(e.id, e.name)}
                          {st?.reason ? (
                            <ScenarioToggle status={st} label={e.name} />
                          ) : (
                            <Checkbox
                              on={active}
                              label={`${e.name} einschalten`}
                              onToggle={() => setField(e.id, "active", !e.active, `„${e.name}“ ${e.active ? "aus" : "ein"}geschaltet`)}
                            />
                          )}
                          <button className="nm" onClick={() => setDialog({ id: e.id })}>
                            <span className="flex items-center gap-2">
                              {mode === "all" && cat && <span className="cdot" style={{ background: cat.color }} />}
                              <span className="truncate">{e.name || "(ohne Namen)"}</span>
                            </span>
                          </button>
                          <button className="pvc" onClick={() => setDialog({ id: e.id })} tabIndex={-1}>
                            {e.provider || <span className="opacity-40">–</span>}
                          </button>
                          <span className="selc">
                            <Select
                              variant="inline"
                              aria-label={`Turnus ${e.name}`}
                              value={e.interval}
                              options={INTERVAL_OPTIONS}
                              onChange={(v) =>
                                setField(e.id, "interval", v as Interval, `${e.name}: ${INTERVAL_LABEL[e.interval]} → ${INTERVAL_LABEL[v as Interval]}`)
                              }
                            />
                          </span>
                          <span className="inpc">
                            <NumberInput
                              label={`Betrag ${e.name}`}
                              value={e.amount}
                              min={0}
                              onChange={(v, start) => setField(e.id, "amount", v, `${e.name} ${formatEur(start)} → ${formatEur(v)}`, true)}
                            />
                          </span>
                          <ValueCell
                            value={r?.monthly ?? 0}
                            active={active}
                            reserve={reserve}
                            override={override && { ...override, original: override.original / INTERVAL_DIVISOR[e.interval], value: override.value / INTERVAL_DIVISOR[e.interval] }}
                          />
                          <RowMenu
                            label={e.name}
                            onEdit={() => setDialog({ id: e.id })}
                            onDuplicate={() =>
                              update(
                                (d) => {
                                  const i = d.expenses.findIndex((x) => x.id === e.id);
                                  d.expenses.splice(i + 1, 0, { ...e, id: newId("exp"), name: `${e.name} (Kopie)` });
                                },
                                { summary: `„${e.name}“ dupliziert` },
                              )
                            }
                            onUp={!sort && idx > 0 ? () => moveWithin(g, idx, -1) : undefined}
                            onDown={!sort && idx < g.items.length - 1 ? () => moveWithin(g, idx, 1) : undefined}
                            onDelete={() => update((d) => removeItem(d, "expense", e.id), { summary: `„${e.name}“ gelöscht` })}
                          />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <div className="empty">Nichts gefunden für „{query}“.</div>}
        </section>}
        {!empty && <p className="table-key">
          <span>
            <IntervalTag interval="quarterly" /> Zahlungen pro Jahr
          </span>
          <span>
            <PiggyBank size={13} strokeWidth={2.2} className="text-sav" /> wird angespart (Monatsanteil → Rücklagen)
          </span>
        </p>}
      </PageGrid>
      {dialog && <ExpenseDialog id={dialog.id} defaultCategoryId={dialog.categoryId} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </Wrap>
  );
}

/** Key figures above the list: monthly fixed costs with category split, reserve, yearly total. */
function FixedStats() {
  const { plan, result } = usePlan();
  const parts = [
    ...plan.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    { id: NO_CATEGORY, name: "Ohne Kategorie", color: "var(--fg-3)" },
  ].map((c) => ({ ...c, value: (result.fixed.byCategory[c.id] ?? 0) + (result.reserveByCategory[c.id] ?? 0) }));
  const active = plan.expenses.filter((e) => result.expenses[e.id]?.status.active);
  const periodicCount = active.filter((e) => e.interval !== "monthly").length;
  const all = result.fixed.total + result.periodic;
  return (
    <div className="stat-row c3 mb-3">
      <div className="stat hero">
        <span className="k inline-flex items-center gap-1.5">
          <Receipt size={14} /> Fixkosten pro Monat
        </span>
        <span className="v n">{formatEur(result.fixed.total)}</span>
        <span className="d">
          {active.length - periodicCount} monatliche Zahlungen
          {result.income.total > 0 && <> · {formatPercent(result.fixed.total, result.income.total)} vom Einkommen</>}
        </span>
        <CompositionBar parts={parts} className="!mx-0 !mt-2 !mb-0" />
      </div>
      <div className="stat">
        <span className="k inline-flex items-center gap-1.5">
          <PiggyBank size={14} /> Rücklage für Jahreszahlungen
        </span>
        <span className="v n text-sav">{formatEur(result.periodic)}</span>
        <span className="d">
          {periodicCount} {periodicCount === 1 ? "Zahlung" : "Zahlungen"} · {formatEur(result.periodic * 12)} im Jahr
        </span>
      </div>
      <div className="stat">
        <span className="k inline-flex items-center gap-1.5">
          <CalendarClock size={14} /> Alles zusammen pro Jahr
        </span>
        <span className="v n">{formatEur(all * 12)}</span>
        <span className="d n">{formatEur(all)} pro Monat inkl. Rücklage</span>
      </div>
    </div>
  );
}
