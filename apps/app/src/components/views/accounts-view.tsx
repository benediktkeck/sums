"use client";

import { useEffect, useMemo, useState } from "react";
import { CandlestickChart, Landmark, Plus, Table2, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select } from "@/components/ui/select";
import { projectSavings } from "@sums/core/engine/project";
import { formatEur, formatNumber } from "@sums/core/format";
import { ACCOUNT_COLORS } from "@sums/core/model/empty";
import { newId, removeAccount } from "@sums/core/model/ops";
import type { AccountKind, SavingsAccount } from "@sums/core/model/schema";
import { NO_AUTOFILL } from "@/lib/no-autofill";
import { GrowthChart, monthDate } from "../growth-chart";
import { PageHeader, Wrap } from "../page";
import { usePlan } from "../plan-provider";
import { Field, NumberInput, Tip, useNewItemShortcut } from "../ui-bits";

const HORIZONS = [1, 3, 5, 10, 20, 30];
const HORIZON_KEY = "sums:horizon";

/** Accounts and depots project the same way; only the wording differs. */
const KIND: Record<AccountKind, { label: string; name: string; balance: string; rate: string; gains: string }> = {
  account: { label: "Sparkonto", name: "Tagesgeld", balance: "Kontostand heute", rate: "Zinsen p. a.", gains: "Zinsen" },
  depot: { label: "Depot", name: "Depot", balance: "Depotwert heute", rate: "Rendite p. a.", gains: "Erträge" },
};
const KIND_OPTIONS = [
  { value: "account", label: "Sparkonto", icon: <Landmark size={15} /> },
  { value: "depot", label: "Depot", icon: <CandlestickChart size={15} /> },
];

/** "ein Konto" style lead text: only names depots once there are some. */
function destinations(accounts: SavingsAccount[]): string {
  const depots = accounts.filter((a) => a.kind === "depot").length;
  const plain = accounts.length - depots;
  const parts = [plain ? (plain === 1 ? "1 Konto" : `${plain} Konten`) : null, depots ? (depots === 1 ? "1 Depot" : `${depots} Depots`) : null];
  return parts.filter(Boolean).join(" und ");
}

function useHorizon() {
  const [years, setYears] = useState(10);
  useEffect(() => {
    const v = Number(localStorage.getItem(HORIZON_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a client-only preference after hydration
    if (HORIZONS.includes(v)) setYears(v);
  }, []);
  return [
    years,
    (y: number) => {
      setYears(y);
      localStorage.setItem(HORIZON_KEY, String(y));
    },
  ] as const;
}

export function AccountsView() {
  const { plan, result, update, undo } = usePlan();
  const [years, setYears] = useHorizon();
  const [showTable, setShowTable] = useState(false);
  const proj = useMemo(() => projectSavings(plan, result, years * 12), [plan, result, years]);
  const [start] = useState(() => new Date());
  const monthly = proj.accounts.reduce((s, a) => s + a.monthly, 0);
  const today = proj.total[0] ?? 0;
  const end = proj.total[proj.months] ?? 0;
  const deposits = proj.accounts.reduce((s, a) => s + a.deposits, 0);
  const interest = proj.accounts.reduce((s, a) => s + a.interest, 0);

  const setAccount = <K extends keyof SavingsAccount>(a: SavingsAccount, key: K, value: SavingsAccount[K], summary: string) =>
    update((d) => void (d.accounts = d.accounts.map((x) => (x.id === a.id ? { ...x, [key]: value } : x))), {
      summary,
      coalesceKey: `account:${a.id}:${String(key)}`,
    });

  const add = (kind: AccountKind = "account") => {
    const sameKind = plan.accounts.filter((a) => a.kind === kind).length;
    const name = sameKind === 0 ? KIND[kind].name : `${kind === "depot" ? "Depot" : "Konto"} ${sameKind + 1}`;
    update(
      (d) =>
        void d.accounts.push({
          id: newId("acc"),
          name,
          kind,
          color: ACCOUNT_COLORS[d.accounts.length % ACCOUNT_COLORS.length],
          balance: 0,
          rate: 0,
        }),
      { summary: `Neues ${KIND[kind].label} „${name}“` },
    );
  };
  useNewItemShortcut(() => add());

  const accountOptions = [
    { value: "", label: "Kein Konto", icon: <span className="size-2.5 flex-none rounded-full border border-line-3" /> },
    ...plan.accounts.map((a) => ({ value: a.id, label: a.name || "(ohne Namen)", icon: <span className="size-2.5 flex-none rounded-full" style={{ background: a.color }} /> })),
  ];

  return (
    <Wrap>
      <PageHeader
        title="Sparkonten"
        lead={
          plan.accounts.length ? (
            <>
              <b className="n">{formatEur(monthly)}</b> fließen jeden Monat auf {destinations(plan.accounts)}
            </>
          ) : (
            "Wohin fließen die Rücklagen? Lege Konten an und sieh, wie sie wachsen."
          )
        }
        action={
          <div className="flex gap-2">
            <button className="btn" onClick={() => add("depot")}>
              <Plus strokeWidth={2.4} />
              <span className="hide-m">Neues Depot</span>
              <span className="only-m">Depot</span>
            </button>
            <button className="btn p" onClick={() => add()} title="Neues Konto (N)">
              <Plus strokeWidth={2.4} />
              <span className="hide-m">Neues Konto</span>
            </button>
          </div>
        }
      />

      {plan.accounts.length === 0 ? (
        <div className="card flex flex-wrap items-center gap-4">
          <Landmark className="text-brand" />
          <div className="min-w-0 flex-1">
            <b>Noch keine Sparkonten</b>
            <p className="text-fg-2">Lege z. B. Tagesgeld oder Depot an, ordne deine Rücklagen zu und sieh die Entwicklung über die Jahre.</p>
          </div>
          <button className="btn" onClick={() => add("depot")}>
            <Plus /> Depot anlegen
          </button>
          <button className="btn p" onClick={() => add()}>
            <Plus /> Konto anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="seg fill-m" role="tablist" aria-label="Zeitraum">
              {HORIZONS.map((y) => (
                <button key={y} role="tab" aria-selected={years === y} className={years === y ? "a" : ""} onClick={() => setYears(y)}>
                  {y}
                  <span className="hide-m">&nbsp;{y === 1 ? "Jahr" : "Jahre"}</span>
                  <span className="only-m">&nbsp;J.</span>
                </button>
              ))}
            </div>
          </div>

          <div className="stat-row">
            <div className="stat hero">
              <span className="k">In {years} {years === 1 ? "Jahr" : "Jahren"}</span>
              <span className="v n">{formatEur(end)}</span>
              <span className="d n">{end - today >= 0 ? "+" : "−"} {formatEur(Math.abs(end - today))} gegenüber heute</span>
            </div>
            <div className="stat">
              <span className="k">Heute</span>
              <span className="v n">{formatEur(today)}</span>
            </div>
            <div className="stat">
              <span className="k">Einzahlungen</span>
              <span className="v n">{formatEur(deposits)}</span>
            </div>
            <div className="stat">
              <span className="k">Zinsen &amp; Erträge</span>
              <span className={`v n ${interest > 0.005 ? "text-pos" : interest < -0.005 ? "text-neg" : ""}`}>{formatEur(interest)}</span>
            </div>
          </div>

          <section className="card !pb-3">
            <h2>
              Entwicklung
              <button className={`btn ghost !h-8 ${showTable ? "is-active" : ""}`} onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
                <Table2 /> Tabelle
              </button>
            </h2>
            <div className="g-legend">
              {proj.accounts.map((a) => (
                <span key={a.account.id}>
                  <i style={{ background: a.account.color }} />
                  {a.account.name || "(ohne Namen)"}
                </span>
              ))}
            </div>
            <GrowthChart
              start={start}
              series={proj.accounts.map((a) => ({ id: a.account.id, name: a.account.name || "(ohne Namen)", color: a.account.color, values: a.series }))}
              total={proj.accounts.length > 1 ? proj.total : undefined}
            />
            {showTable && <YearTable proj={proj} start={start} />}
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {proj.accounts.map((p) => {
              const a = p.account;
              const kind = KIND[a.kind];
              const buckets = plan.savings.filter((b) => p.bucketIds.includes(b.id));
              return (
                <section className="card acc" key={a.id}>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      label={`Farbe ${a.name} wählen`}
                      value={a.color}
                      themed={ACCOUNT_COLORS}
                      className="size-6 flex-none rounded-full"
                      onChange={(c) => setAccount(a, "color", c, `Farbe „${a.name}“ geändert`)}
                    />
                    <input
                      {...NO_AUTOFILL}
                      className="field min-w-0 flex-1 font-semibold"
                      aria-label="Name"
                      value={a.name}
                      onChange={(e) => setAccount(a, "name", e.target.value, `${kind.label} „${e.target.value}“ umbenannt`)}
                    />
                    <button
                      className="btn ibtn ghost danger !size-8"
                      aria-label={`${a.name} löschen`}
                      title="Löschen"
                      onClick={() => {
                        update((d) => removeAccount(d, a.id), { summary: `${kind.label} „${a.name}“ gelöscht` });
                        toast(`„${a.name}“ gelöscht`, { action: { label: "Rückgängig", onClick: () => void undo() } });
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <Field label="Art">
                    <Select
                      aria-label={`Art von ${a.name}`}
                      value={a.kind}
                      options={KIND_OPTIONS}
                      onChange={(v) => setAccount(a, "kind", v as AccountKind, `${a.name}: ${kind.label} → ${KIND[v as AccountKind].label}`)}
                    />
                  </Field>
                  <div className="row2">
                    <Field label={kind.balance}>
                      <NumberInput
                        className="field num"
                        label={kind.balance}
                        value={a.balance}
                        onChange={(v, s) => setAccount(a, "balance", v, `${a.name}: ${kind.balance.replace(" heute", "")} ${formatEur(s)} → ${formatEur(v)}`)}
                      />
                    </Field>
                    <Field label={kind.rate}>
                      <NumberInput
                        className="field num"
                        label={kind.rate}
                        value={a.rate}
                        decimals={2}
                        suffix="%"
                        onChange={(v, s) => setAccount(a, "rate", Math.max(-100, Math.min(100, v)), `${a.name}: ${kind.gains} ${formatNumber(s, 2)} % → ${formatNumber(v, 2)} %`)}
                      />
                    </Field>
                  </div>
                  <div className="acc-in">
                    {buckets.map((b) => (
                      <span key={b.id} className={`tag ${result.status.savings[b.id]?.active ? "" : "opacity-50 line-through"}`}>
                        {b.name} <span className="n ml-1 font-normal text-fg-3">{formatEur(result.savings.items[b.id] ?? 0)}</span>
                      </span>
                    ))}
                    {p.receivesSurplus && (
                      <span className="tag brand">
                        Überschuss <span className="n ml-1 font-normal">{formatEur(result.surplus)}</span>
                      </span>
                    )}
                    {buckets.length === 0 && !p.receivesSurplus && <span className="text-[13px] text-fg-3">Noch keine Rücklage zugeordnet</span>}
                  </div>
                  <div className="acc-foot">
                    <div>
                      <span className="k">pro Monat</span>
                      <span className="v n">+ {formatEur(p.monthly)}</span>
                    </div>
                    <div className="text-right">
                      <span className="k">
                        in {years} {years === 1 ? "Jahr" : "Jahren"}
                        {Math.abs(p.interest) >= 0.005 && (
                          <span className={`n ml-2 ${p.interest > 0 ? "text-pos" : "text-neg"}`}>
                            <TrendingUp size={13} className="mr-1 inline" />
                            {formatEur(p.interest)} {kind.gains}
                          </span>
                        )}
                      </span>
                      <span className="v n big">{formatEur(p.end)}</span>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="panel">
            <div className="ov-head !bg-raised">
              <span className="ov-title">Zuordnung</span>
              <span className="sp" />
              {proj.unassigned > 0.005 && (
                <Tip content="Rücklagen und Überschuss ohne Konto fließen nicht in die Entwicklung ein">
                  <span className="tag sav">{formatEur(proj.unassigned)} / Monat ohne Konto</span>
                </Tip>
              )}
            </div>
            <div className="cols r-assign">
              <span>Rücklage</span>
              <span className="rt">Pro Monat</span>
              <span>Konto</span>
            </div>
            {plan.savings.map((b) => {
              const active = result.status.savings[b.id]?.active;
              return (
                <div className="li assign" key={b.id}>
                  <span className={`k ${active ? "" : "text-fg-3"}`}>{b.name || "(ohne Namen)"}</span>
                  <span className={`n assign-amt ${active ? "" : "text-fg-3 line-through"}`}>{formatEur(result.savings.raw[b.id] ?? b.amount)}</span>
                  <span className="assign-sel">
                    <Select
                      aria-label={`Konto für ${b.name}`}
                      value={b.accountId ?? ""}
                      options={accountOptions}
                      onChange={(v) =>
                        update((d) => void (d.savings = d.savings.map((x) => (x.id === b.id ? { ...x, accountId: v || null } : x))), {
                          summary: `${b.name} → ${plan.accounts.find((x) => x.id === v)?.name ?? "kein Konto"}`,
                        })
                      }
                    />
                  </span>
                </div>
              );
            })}
            <div className="li assign">
              <span className="k truncate">
                Überschuss
                <span className="hide-m ml-2 text-[13px] text-fg-3">was nach dem Taschengeld übrig bleibt</span>
              </span>
              <span className="n assign-amt">{formatEur(result.surplus)}</span>
              <span className="assign-sel">
                <Select
                  aria-label="Konto für den Überschuss"
                  value={plan.settings.surplusAccountId ?? ""}
                  options={accountOptions}
                  onChange={(v) =>
                    update((d) => void (d.settings = { ...d.settings, surplusAccountId: v || null }), {
                      summary: `Überschuss → ${plan.accounts.find((x) => x.id === v)?.name ?? "kein Konto"}`,
                    })
                  }
                />
              </span>
            </div>
          </section>
        </div>
      )}
    </Wrap>
  );
}

function YearTable({ proj, start }: { proj: ReturnType<typeof projectSavings>; start: Date }) {
  const rows: number[] = [];
  for (let m = 0; m <= proj.months; m += 12) rows.push(m);
  if (rows[rows.length - 1] !== proj.months) rows.push(proj.months);
  return (
    <div className="mt-3 overflow-x-auto border-t border-line">
      <table className="g-table">
        <thead>
          <tr>
            <th>Zeitpunkt</th>
            {proj.accounts.map((a) => (
              <th key={a.account.id}>{a.account.name}</th>
            ))}
            {proj.accounts.length > 1 && <th>Gesamt</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m}>
              <td>{m === 0 ? "Heute" : monthDate(start, m).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}</td>
              {proj.accounts.map((a) => (
                <td key={a.account.id} className="n">
                  {formatEur(a.series[m])}
                </td>
              ))}
              {proj.accounts.length > 1 && <td className="n font-semibold">{formatEur(proj.total[m])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
