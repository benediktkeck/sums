"use client";

import Link from "next/link";
import { ArrowRight, Fuel, PiggyBank, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { SetupChecklist, useSetupOpen } from "../onboarding/setup-guide";
import { NO_CATEGORY, type ItemStatus } from "@sums/core/engine/calculate";
import { CheckMark, CompositionBar, Tip } from "../ui-bits";
import { formatEur, formatPercent } from "@sums/core/format";
import { PageGrid, PageHeader, Wrap } from "../page";
import { isBlankPlan } from "@sums/core/model/ops";
import { usePlan } from "../plan-provider";
import { Welcome } from "../welcome";

function SectionCard({
  title,
  href,
  total,
  icon: Icon,
  children,
}: {
  title: string;
  href: string;
  total: number;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <Link href={href} className="ov-head group">
        <Icon size={17} className="ov-icon" />
        <span className="ov-title">{title}</span>
        <span className="sp" />
        <span className="ov-total n">{formatEur(total)}</span>
        <ArrowRight size={16} className="text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
      <div className="ov-body">{children}</div>
    </section>
  );
}

function Line({
  label,
  cells,
  value,
  color,
  share,
  muted,
  status,
}: {
  label: string;
  /** Extra columns between label and share; dropped when the card is too narrow. */
  cells?: React.ReactNode;
  value: number;
  color?: string;
  share?: number;
  muted?: boolean;
  status?: ItemStatus;
}) {
  return (
    <div className="li">
      {color && <span className="cdot" style={{ background: color }} />}
      {status?.reason && (
        <Tip content={<>Szenario „{status.reason.switchName}“ schaltet das {status.active ? "ein" : "aus"}</>}>
          <span className={`cb scen ${status.active ? "on" : ""}`}>{status.active && <CheckMark />}</span>
        </Tip>
      )}
      <span className={`k truncate ${muted ? "text-fg-3" : ""}`}>{label}</span>
      {cells}
      {share != null && <span className="ov-share n">{formatPercent(share, 1)}</span>}
      <span className={`n w-28 flex-none text-right font-medium ${muted ? "text-fg-3" : ""}`}>{formatEur(value)}</span>
    </div>
  );
}

/** One bar split by category: how the fixed costs divide up. */
export function OverviewView() {
  const { plan } = usePlan();
  return isBlankPlan(plan) ? <Welcome /> : <Overview />;
}

function Overview() {
  const { plan, result } = usePlan();
  const setupOpen = useSetupOpen();
  const eff = result.effective;

  const cats = [
    ...plan.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    { id: NO_CATEGORY, name: "Ohne Kategorie", color: "var(--fg-3)" },
  ]
    .map((c) => ({
      ...c,
      fixed: result.fixed.byCategory[c.id] ?? 0,
      reserve: result.reserveByCategory[c.id] ?? 0,
      count: plan.expenses.filter((e) => (e.categoryId ?? NO_CATEGORY) === c.id).length,
    }))
    .filter((c) => c.count > 0);

  return (
    <Wrap>
      <PageHeader
        title="Übersicht"
        lead={
          result.free >= 0 ? (
            <>
              <b className="n">{formatEur(result.free)}</b> bleiben jeden Monat frei · Überschuss <b className="n">{formatEur(result.surplus)}</b>
            </>
          ) : (
            <>
              Es fehlen <b className="n text-neg">{formatEur(result.shortfall)}</b> pro Monat
            </>
          )
        }
      />
      <PageGrid overview>
        <SetupChecklist />
        {/* While steps are open, the checklist stands in for the still empty section cards. */}
        {setupOpen === false && (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Fixkosten" href="/fixkosten" total={result.fixed.total} icon={Receipt}>
              <CompositionBar parts={cats.map((c) => ({ id: c.id, name: c.name, value: c.fixed, color: c.color }))} />
              {cats.map((c) => (
                <Line
                  key={c.id}
                  label={c.name}
                  cells={
                    <>
                      <span className="ov-cell w-20">
                        {c.count} {c.count === 1 ? "Eintrag" : "Einträge"}
                      </span>
                      <span className="ov-cell n w-24">
                        {c.reserve > 0 && (
                          <Tip content="Jahreszahlungen dieser Kategorie, monatlich in den Rücklagen angespart">
                            <span className="ov-res">
                              <PiggyBank size={13} /> {formatEur(c.reserve)}
                            </span>
                          </Tip>
                        )}
                      </span>
                    </>
                  }
                  value={c.fixed}
                  color={c.color}
                  share={result.fixed.total > 0 ? c.fixed / result.fixed.total : 0}
                />
              ))}
              {cats.length === 0 && <div className="empty">Keine Ausgaben</div>}
            </SectionCard>
            <SectionCard title="Einkommen" href="/einkommen" total={result.income.total} icon={Wallet}>
              {eff.incomes.map((i) => {
                const active = result.status.income[i.id]?.active;
                return (
                  <Line
                    key={i.id}
                    label={i.label}
                    status={result.status.income[i.id]}
                    value={active ? i.amount : 0}
                    muted={!active}
                  />
                );
              })}
              {eff.incomes.length === 0 && <div className="empty">Kein Einkommen</div>}
            </SectionCard>
            <SectionCard title="Variable Kosten" href="/variable" total={result.variable.total} icon={Fuel}>
              {eff.variableCosts.map((v) => (
                <Line
                  key={v.id}
                  label={v.label}
                  value={result.variable.items[v.id] ?? 0}
                  muted={!result.status.variable[v.id]?.active}
                  status={result.status.variable[v.id]}
                />
              ))}
              {eff.variableCosts.length === 0 && <div className="empty">Keine variablen Kosten</div>}
            </SectionCard>
            <SectionCard title="Rücklagen" href="/ruecklagen" total={result.savings.total} icon={PiggyBank}>
              <Line label="Periodische Ausgaben" value={result.periodic} />
              {eff.savings.map((s) => (
                <Line key={s.id} label={s.name} value={result.savings.items[s.id] ?? 0} muted={!result.status.savings[s.id]?.active} status={result.status.savings[s.id]} />
              ))}
            </SectionCard>
          </div>
        )}
      </PageGrid>
    </Wrap>
  );
}
