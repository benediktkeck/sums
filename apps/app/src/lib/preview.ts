import { carOf, INTERVAL_DIVISOR, type CalcResult } from "@sums/core/engine/calculate";
import { projectSavings } from "@sums/core/engine/project";
import { formatEur, formatNumber } from "@sums/core/format";
import { INTERVAL_LABEL } from "@sums/core/model/ops";
import type { Expense, Plan } from "@sums/core/model/schema";

export type PreviewRow = {
  id: string;
  name: string;
  /** Muted text next to the name (provider). */
  note?: string;
  /** Content of the middle column. */
  detail?: string;
  value: number;
  color?: string;
  /** Monthly share of a periodic payment: goes to the reserve, not paid every month. */
  reserve?: boolean;
  /** Calculation sign in front of the name, as in the sidebar. */
  op?: string;
  opColor?: string;
  /** Intermediate result inside a calculation. */
  strong?: boolean;
};

export type PreviewSection = { id: string; name?: string; color?: string; total?: number; note?: string; rows: PreviewRow[] };

export type PreviewFooterLine = { label: string; value: number; detail?: string; op?: string; opColor?: string };

export type PreviewDoc = {
  title: string;
  total: number;
  /** Line below the big number. */
  caption: string;
  detailHeader?: string;
  valueHeader: string;
  sections: PreviewSection[];
  /** Closing lines; the last one is the emphasized sum. */
  footer: PreviewFooterLine[];
  /** Stacked bar below the table. */
  bar?: { label: string; value: number; color: string }[];
  /** Second table below the bar. */
  after?: { sections: PreviewSection[]; footer: PreviewFooterLine[] };
  /** Items left out because they don't count right now. */
  hidden: number;
};

/** Like `formatEur`, with a typographic minus set apart from the digits. */
export function signedEur(n: number): string {
  return n <= -0.005 ? `− ${formatEur(-n)}` : formatEur(n);
}

const sum = (rows: PreviewRow[]) => rows.reduce((s, r) => s + r.value, 0);

function section(id: string, name: string, color: string | undefined, rows: PreviewRow[]): PreviewSection {
  return { id, name, color, total: sum(rows), rows };
}

/** One-liner like "Jährlich · 480,00 €", empty for monthly payments. */
function intervalDetail(e: Expense): string | undefined {
  return e.interval === "monthly" ? undefined : `${INTERVAL_LABEL[e.interval]} · ${formatEur(e.amount)}`;
}

function expenseRow(e: Expense, result: CalcResult): PreviewRow {
  return {
    id: e.id,
    name: e.name || "(ohne Namen)",
    note: e.provider || undefined,
    detail: intervalDetail(e),
    value: result.expenses[e.id].monthly,
    reserve: e.interval !== "monthly",
  };
}

function fixedDoc(plan: Plan, result: CalcResult): PreviewDoc {
  const all = result.effective.expenses;
  const active = all.filter((e) => result.expenses[e.id]?.status.active);
  const known = new Set(plan.categories.map((c) => c.id));
  const sections = plan.categories.map((c) =>
    section(c.id, c.name, c.color, active.filter((e) => e.categoryId === c.id).map((e) => expenseRow(e, result))),
  );
  const orphans = active.filter((e) => !e.categoryId || !known.has(e.categoryId));
  sections.push(section("none", "Ohne Kategorie", "var(--fg-3)", orphans.map((e) => expenseRow(e, result))));
  const total = result.fixed.total + result.periodic;
  return {
    title: "Fixkosten",
    total: result.fixed.total,
    caption: result.periodic > 0 ? `pro Monat · dazu ${formatEur(result.periodic)} Rücklage für Jahreszahlungen` : "pro Monat",
    detailHeader: "Turnus",
    valueHeader: "Pro Monat",
    sections: sections.filter((s) => s.rows.length > 0),
    footer: result.periodic > 0
      ? [
          { label: "Monatliche Zahlungen", value: result.fixed.total },
          { label: "Rücklage für Jahreszahlungen", value: result.periodic },
          { label: "Gesamt pro Monat", value: total },
        ]
      : [{ label: "Gesamt pro Monat", value: total }],
    hidden: all.length - active.length,
  };
}

function incomeDoc(plan: Plan, result: CalcResult): PreviewDoc {
  const all = result.effective.incomes;
  const active = all.filter((i) => result.status.income[i.id]?.active);
  const row = (i: (typeof all)[number]): PreviewRow => ({ id: i.id, name: i.label || "(ohne Namen)", value: result.income.items[i.id] ?? 0 });
  const known = new Set(plan.persons.map((p) => p.id));
  const sections = plan.persons.map((p) => section(p.id, p.name, p.color, active.filter((i) => i.personId === p.id).map(row)));
  sections.push(section("none", "Ohne Person", "var(--fg-3)", active.filter((i) => !i.personId || !known.has(i.personId)).map(row)));
  return {
    title: "Einkommen",
    total: result.income.total,
    caption: "netto pro Monat",
    valueHeader: "Pro Monat",
    sections: sections.filter((s) => s.rows.length > 0),
    footer: [{ label: "Gesamt pro Monat", value: result.income.total }],
    hidden: all.length - active.length,
  };
}

function variableDoc(result: CalcResult): PreviewDoc {
  const eff = result.effective;
  const active = eff.variableCosts.filter((v) => result.status.variable[v.id]?.active);
  const rows = active.map((v): PreviewRow => {
    const person = v.kind === "commute-fuel" ? eff.persons.find((p) => p.id === v.personId) : undefined;
    const car = person && carOf(eff, person);
    const detail = person
      ? [`${formatNumber(person.officeDaysPerWeek)} Tage`, `${formatNumber(person.commuteKm)} km`, car?.name].filter(Boolean).join(" · ")
      : undefined;
    return { id: v.id, name: v.label || "(ohne Namen)", detail, value: result.variable.items[v.id] ?? 0 };
  });
  return {
    title: "Variable Kosten",
    total: result.variable.total,
    caption: "pro Monat",
    detailHeader: "Grundlage",
    valueHeader: "Pro Monat",
    sections: rows.length ? [{ id: "all", rows }] : [],
    footer: [{ label: "Gesamt pro Monat", value: result.variable.total }],
    hidden: eff.variableCosts.length - active.length,
  };
}

function savingsDoc(plan: Plan, result: CalcResult): PreviewDoc {
  const eff = result.effective;
  const active = eff.savings.filter((s) => result.status.savings[s.id]?.active);
  const own = active.map((s): PreviewRow => {
    const account = plan.accounts.find((a) => a.id === s.accountId);
    return { id: s.id, name: s.name || "(ohne Namen)", detail: account?.name, value: result.savings.items[s.id] ?? 0 };
  });
  const periodic = eff.expenses
    .filter((e) => e.interval !== "monthly" && result.expenses[e.id]?.status.active)
    .sort((a, b) => INTERVAL_DIVISOR[b.interval] - INTERVAL_DIVISOR[a.interval])
    .map((e) => expenseRow(e, result));
  const sections = [section("own", "Eigene Rücklagen", undefined, own), section("periodic", "Periodische Ausgaben", undefined, periodic)];
  return {
    title: "Rücklagen",
    total: result.savings.total,
    caption: "pro Monat",
    detailHeader: "Konto / Turnus",
    valueHeader: "Pro Monat",
    sections: sections.filter((s) => s.rows.length > 0),
    footer: [{ label: "Gesamt pro Monat", value: result.savings.total }],
    hidden: eff.savings.length - active.length,
  };
}

function accountsDoc(plan: Plan, result: CalcResult): PreviewDoc {
  const accounts = projectSavings(plan, result, 12).accounts;
  const rows = accounts.map(({ account: a, monthly }): PreviewRow => ({
    id: a.id,
    name: a.name || "(ohne Namen)",
    note: [a.kind === "depot" ? "Depot" : null, a.rate ? `${formatNumber(a.rate, 2)} % p. a.` : null].filter(Boolean).join(" · ") || undefined,
    detail: `+ ${formatEur(monthly)} / Monat`,
    value: a.balance,
    color: a.color,
  }));
  const total = sum(rows);
  const monthly = accounts.reduce((s, a) => s + a.monthly, 0);
  return {
    title: "Sparkonten",
    total,
    caption: `aktueller Stand · + ${formatEur(monthly)} pro Monat`,
    detailHeader: "Sparrate",
    valueHeader: "Stand",
    sections: rows.length ? [{ id: "all", rows }] : [],
    footer: [{ label: "Gesamt", value: total }],
    hidden: 0,
  };
}

/** The sidebar top to bottom: the calculation, the split bar, then the allowance per person. */
function overviewDoc(result: CalcResult): PreviewDoc {
  const { free, surplus } = result;
  const neg = free < 0;
  const persons = result.effective.persons;
  const allowance = result.allowance.total;
  const splitFree = !neg && allowance > 0.005;
  const year = (n: number) => signedEur(n * 12);
  const line = (id: string, name: string, value: number, op?: string, color?: string): PreviewRow => ({ id, name, value, op, opColor: color, detail: year(value) });

  const rows = [
    line("income", "Einkommen", result.income.total),
    line("fixed", "Fixkosten", result.fixed.total, "−", "var(--s-fixed)"),
    line("variable", "Variable Kosten", result.variable.total, "−", "var(--s-var)"),
    line("savings", "Rücklagen", result.savings.total, "−", "var(--sav)"),
  ];
  const soft = "color-mix(in srgb, var(--pos) 50%, var(--panel))";
  if (splitFree) {
    rows.push(
      { ...line("free", "Frei verfügbar", free, "="), strong: true },
      {
        ...line("allowance", "Taschengeld", allowance, "−", soft),
        note: result.effective.settings.splitMode === "income" ? "nach Einkommen" : `${persons.length} × ${formatEur(allowance / persons.length)}`,
      },
    );
  }
  const cap = result.effective.settings.allowanceCap;
  const rest = splitFree
    ? [
        { label: "Taschengeld", value: allowance, color: soft },
        { label: "Überschuss", value: surplus, color: "var(--brand)" },
      ]
    : [{ label: neg ? "Fehlbetrag" : "Frei", value: Math.abs(free), color: neg ? "var(--neg)" : soft }];

  return {
    title: "Was bleibt übrig?",
    total: free,
    caption: neg ? "fehlen pro Monat" : splitFree ? `frei pro Monat · ${formatEur(surplus)} wirklich übrig` : "frei pro Monat",
    detailHeader: "Pro Jahr",
    valueHeader: "Pro Monat",
    sections: [{ id: "calc", rows }],
    footer: [
      splitFree
        ? { label: "Überschuss", value: surplus, detail: year(surplus), op: "=", opColor: "var(--brand)" }
        : { label: "Frei verfügbar", value: free, detail: year(free), op: "=", opColor: rest[0].color },
    ],
    bar: [
      { label: "Fixkosten", value: result.fixed.total, color: "var(--s-fixed)" },
      { label: "Variabel", value: result.variable.total, color: "var(--s-var)" },
      { label: "Rücklagen", value: result.savings.total, color: "var(--sav)" },
      ...rest,
    ],
    after: persons.length && result.effective.settings.splitMode !== "none"
      ? {
          sections: [
            {
              id: "allowance",
              name: "Taschengeld",
              note: `max. ${formatEur(cap)}`,
              rows: persons.map((p) => {
                const amount = result.allowance.perPerson[p.id] ?? 0;
                return { id: p.id, name: p.name, color: p.color, value: amount, detail: year(amount) };
              }),
            },
          ],
          footer: [
            neg
              ? { label: "Fehlbetrag", value: result.shortfall, detail: year(result.shortfall) }
              : { label: "Überschuss", value: surplus, detail: year(surplus) },
          ],
        }
      : undefined,
    hidden: 0,
  };
}

/** Pages with a preview, in tab order. */
export const PREVIEW_PAGES: { href: string; label: string; build: (plan: Plan, result: CalcResult) => PreviewDoc }[] = [
  { href: "/uebersicht", label: "Übersicht", build: (_, result) => overviewDoc(result) },
  { href: "/fixkosten", label: "Fixkosten", build: fixedDoc },
  { href: "/einkommen", label: "Einkommen", build: incomeDoc },
  { href: "/variable", label: "Variable Kosten", build: (_, result) => variableDoc(result) },
  { href: "/ruecklagen", label: "Rücklagen", build: savingsDoc },
  { href: "/sparkonten", label: "Sparkonten", build: accountsDoc },
];

export function previewPage(pathname: string) {
  return PREVIEW_PAGES.find((p) => pathname === p.href);
}
