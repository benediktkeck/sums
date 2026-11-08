"use client";

import Link from "next/link";
import { Check, ChevronsRight } from "lucide-react";
import { formatDelta, formatEur, formatPercent } from "@sums/core/format";
import { usePlan } from "./plan-provider";
import { ScenarioCard } from "./scenarios";
import { Op, Tip } from "./ui-bits";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && parts[parts.length - 1].length <= 2) return parts[parts.length - 1].toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const SOFT_POS = "color-mix(in srgb, var(--pos) 50%, var(--panel))";

type AllowanceState = "none" | "partial" | "full" | "capped";

/** How the allowance relates to the cap: below it, exactly at it, or cut off by it. */
function allowanceState(share: number, cap: number): AllowanceState {
  if (share <= 0.005) return "none";
  if (Math.abs(share - cap) < 0.005) return "full";
  return share < cap ? "partial" : "capped";
}

export function Summary({ className = "" }: { className?: string }) {
  const { plan, result, period, setPeriod, lastChange } = usePlan();
  const f = period === "year" ? 12 : 1;
  const free = result.free;
  const neg = free < 0;
  const persons = result.effective.persons;
  const splitMode = result.effective.settings.splitMode;
  const allowance = result.allowance.total;
  // The allowance split only adds something once money actually goes to it.
  const splitFree = !neg && allowance > 0.005;

  const total = Math.max(result.income.total, result.fixed.total + result.variable.total + result.savings.total);
  const parts = [
    { key: "fixed", label: "Fixkosten", value: result.fixed.total, color: "var(--s-fixed)" },
    { key: "var", label: "Variabel", value: result.variable.total, color: "var(--s-var)" },
    { key: "sav", label: "Rücklagen", value: result.savings.total, color: "var(--sav)" },
  ];
  const rest = splitFree
    ? [
        { key: "allowance", label: "Taschengeld", value: allowance, color: SOFT_POS },
        { key: "surplus", label: "Überschuss", value: result.surplus, color: "var(--brand)" },
      ]
    : [{ key: "free", label: neg ? "Fehlbetrag" : "Frei", value: Math.abs(free), color: neg ? "var(--neg)" : SOFT_POS }];
  const lines = [
    { op: " ", label: "Einkommen", href: "/einkommen", value: result.income.total },
    { op: "−", label: "Fixkosten", href: "/fixkosten", value: result.fixed.total, color: "var(--s-fixed)" },
    { op: "−", label: "Variable Kosten", href: "/variable", value: result.variable.total, color: "var(--s-var)" },
    { op: "−", label: "Rücklagen", href: "/ruecklagen", value: result.savings.total, color: "var(--sav)" },
  ];

  return (
    <aside className={`side ${className}`} aria-label="Zusammenfassung">
      <div className="card">
        <h2>
          Was bleibt übrig?
          <div className="mini-seg" role="tablist" aria-label="Zeitraum">
            <button role="tab" aria-selected={period === "month"} className={period === "month" ? "a" : ""} onClick={() => setPeriod("month")}>
              Monat
            </button>
            <button role="tab" aria-selected={period === "year"} className={period === "year" ? "a" : ""} onClick={() => setPeriod("year")}>
              Jahr
            </button>
          </div>
        </h2>
        <div className="free">
          <div className="free-top">
            <div className={`big n ${neg ? "neg" : ""}`}>{formatEur((neg ? -free : free) * f)}</div>
            {lastChange?.delta != null && Math.abs(lastChange.delta) >= 0.005 && (
              <Tip content={lastChange.summary} side="left">
                <span className={`chg n ${lastChange.delta < 0 ? "down" : "up"}`}>{formatDelta(lastChange.delta * f)}</span>
              </Tip>
            )}
          </div>
          {neg && <p>fehlen {period === "year" ? "im Jahr" : "im Monat"}</p>}
          {splitFree && (
            <p className="after">
              <b className="n">{formatEur(result.surplus * f)}</b> wirklich übrig
            </p>
          )}
        </div>
        {total === 0 && (
          <p className="side-hint">Hier wird live mitgerechnet: Sobald du Einkommen und Ausgaben einträgst, siehst du, was jeden Monat übrig bleibt.</p>
        )}
        <div className="calc">
          {lines.map((l) => (
            <div className="cl" key={l.label}>
              <Op op={l.op} color={l.color} />
              <Link href={l.href} className="k hover:text-brand">
                {l.label}
              </Link>
              <span className="v n">{formatEur(l.value * f)}</span>
            </div>
          ))}
          <div className="cl res">
            <Op op="=" color={splitFree ? undefined : rest[0].color} />
            <span className="k">Frei verfügbar</span>
            <span className={`v n ${neg ? "text-neg" : ""}`}>{formatEur(free * f)}</span>
          </div>
          {splitFree && (
            <>
              <div className="cl">
                <Op op="−" color={rest[0].color} />
                <Link href="/einstellungen" className="k hover:text-brand">
                  Taschengeld
                  <small>
                    {splitMode === "income" ? "nach Einkommen" : `${persons.length} × ${formatEur((allowance / persons.length) * f)}`}
                  </small>
                </Link>
                <span className="v n">{formatEur(allowance * f)}</span>
              </div>
              <div className="cl res final">
                <Op op="=" color={rest[1].color} />
                <span className="k">Überschuss</span>
                <span className="v n">{formatEur(result.surplus * f)}</span>
              </div>
            </>
          )}
        </div>
        {total > 0 && (
          <>
            <div className="bar" aria-hidden>
              {parts.map((p) => (p.value > 0 ? <i key={p.key} style={{ flex: p.value, background: p.color }} /> : null))}
              {free > 0 && rest.map((p) => (p.value > 0 ? <i key={p.key} style={{ flex: p.value, background: p.color }} /> : null))}
            </div>
            <div className="barl">
              {parts.map((p) => (
                <span key={p.key}>
                  <i style={{ background: p.color }} />
                  {p.label} {formatPercent(p.value, total)}
                </span>
              ))}
              {rest.map((p) => (
                <span key={p.key}>
                  <i style={{ background: p.color }} />
                  {p.label} {formatPercent(p.value, total)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Before any amount is entered, scenarios and pocket money have nothing to show. */}
      {(total > 0 || plan.switches.length > 0) && <ScenarioCard />}

      {total > 0 && splitMode !== "none" && <AllowanceCard />}
    </aside>
  );
}

/** Pocket money per person against the cap, then the surplus. */
function AllowanceCard() {
  const { result, period } = usePlan();
  const f = period === "year" ? 12 : 1;
  const neg = result.free < 0;
  const persons = result.effective.persons;
  const cap = result.effective.settings.allowanceCap;
  const anyCapped = persons.some((p) => allowanceState(result.allowance.share[p.id] ?? 0, cap) === "capped");
  return (
    <div className="card">
      <h2>
        Taschengeld
        <Link href="/einstellungen" className="tag n hover:!text-brand">
          max. {formatEur(cap * f)}
        </Link>
      </h2>
      <div className="mt-2">
        {persons.map((p) => {
          const amount = result.allowance.perPerson[p.id] ?? 0;
          const share = result.allowance.share[p.id] ?? 0;
          const state = allowanceState(share, cap);
          const fill = cap > 0 ? Math.min(1, Math.max(0, share) / cap) : 0;
          return (
            <div className={`pp allowance ${state}`} key={p.id}>
              <span className="av" style={{ background: p.color }}>
                {initials(p.name)}
              </span>
              <span className="k">
                {p.name}
                <span className="meter-row" aria-hidden>
                  <span className="meter">
                    <i style={{ width: `${fill * 100}%` }} />
                  </span>
                  {state === "capped" && <ChevronsRight size={14} strokeWidth={2.6} className="flex-none text-brand" />}
                </span>
              </span>
              <AllowanceValue state={state} amount={amount * f} cap={cap * f} share={share * f} />
            </div>
          );
        })}
        {persons.length === 0 && (
          <Link href="/einstellungen/personen" className="pp text-fg-3 hover:text-brand">
            + Personen anlegen
          </Link>
        )}
      </div>
      {neg ? (
        <div className="surplus neg">
          <div className="k">Fehlbetrag</div>
          <div className="v n text-neg">{formatEur(result.shortfall * f)}</div>
        </div>
      ) : (
        <div className={`surplus ${result.surplus > 0.005 ? "" : "empty-surplus"}`}>
          <div className="k inline-flex items-center gap-1.5">
            {anyCapped && <ChevronsRight size={16} className="text-brand" />}
            Überschuss
          </div>
          <div className="v n">{formatEur(result.surplus * f)}</div>
        </div>
      )}
    </div>
  );
}

function AllowanceValue({ state, amount, cap, share }: { state: AllowanceState; amount: number; cap: number; share: number }) {
  if (state === "capped") {
    return (
      <Tip content={<>Gedeckelt: {formatEur(share - cap)} mehr pro Person gehen in den Überschuss</>} side="left">
        <span className="v n inline-flex items-center gap-1.5">
          {formatEur(amount)}
          <span className="tag brand !h-5 !px-1.5 text-[10.5px] tracking-wide">MAX</span>
        </span>
      </Tip>
    );
  }
  if (state === "full") {
    return (
      <Tip content="Passt genau bis zur Obergrenze" side="left">
        <span className="v n inline-flex items-center gap-1.5 text-pos">
          {formatEur(amount)}
          <Check size={15} strokeWidth={2.6} />
        </span>
      </Tip>
    );
  }
  if (state === "partial") {
    return (
      <Tip content={<>Unter der Obergrenze: es fehlen {formatEur(cap - amount)} bis zum Maximum</>} side="left">
        <span className="v n text-right leading-tight">
          <span className="text-sav">{formatEur(amount)}</span>
          <span className="block text-[12px] font-normal text-fg-3">von {formatEur(cap)}</span>
        </span>
      </Tip>
    );
  }
  return <span className="v n text-fg-3">{formatEur(0)}</span>;
}
