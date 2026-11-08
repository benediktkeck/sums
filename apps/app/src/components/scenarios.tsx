"use client";

import { Pencil, Plus } from "lucide-react";
import { calculateWithSwitch } from "@sums/core/engine/calculate";
import { formatEur } from "@sums/core/format";
import { usePlan } from "./plan-provider";
import { Tip } from "./ui-bits";
import { useUi } from "./ui-context";

const whole = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** Sidebar card: one toggle row per scenario with its impact on the free amount. */
export function ScenarioCard() {
  const { plan, update } = usePlan();
  const { editSwitch } = useUi();

  return (
    <section className="card !p-0" aria-label="Szenarien">
      <h2 className="!px-5 !pt-4 !pb-2">
        Szenarien
        <Tip content="Neues Szenario">
          <button className="menu" aria-label="Neues Szenario" onClick={() => editSwitch(null)}>
            <Plus size={16} />
          </button>
        </Tip>
      </h2>
      <div className="pb-2">
        {plan.switches.map((s) => {
          const on = calculateWithSwitch(plan, s.id, true).free;
          const off = calculateWithSwitch(plan, s.id, false).free;
          const impact = on - off;
          const zero = Math.abs(impact) < 0.5;
          return (
            <div key={s.id} className={`scrow group ${s.on ? "on" : ""}`}>
              <button
                role="switch"
                aria-checked={s.on}
                className="scrow-main"
                onClick={() =>
                  update(
                    (d) => {
                      const sw = d.switches.find((x) => x.id === s.id);
                      if (sw) sw.on = !sw.on;
                    },
                    { summary: `Szenario „${s.name}“ ${s.on ? "aus" : "ein"}geschaltet` },
                  )
                }
              >
                <span className={`sw ${s.on ? "on" : ""}`} />
                <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
                <Tip content={<>Frei verfügbar: an {formatEur(on)} · aus {formatEur(off)}</>} side="left">
                  <span className={`impact-pill n ${zero ? "zero" : impact < 0 ? "neg" : "pos"}`}>
                    {zero ? "±0 €" : `${impact < 0 ? "−" : "+"}${whole.format(Math.abs(impact))} €`}
                  </span>
                </Tip>
              </button>
              <button className="scrow-edit" aria-label={`Szenario ${s.name} bearbeiten`} onClick={() => editSwitch(s.id)}>
                <Pencil size={14} />
              </button>
            </div>
          );
        })}
        {plan.switches.length === 0 && (
          <button className="scrow-main w-full text-fg-3 hover:text-brand" onClick={() => editSwitch(null)}>
            <Plus size={16} /> Szenario anlegen
          </button>
        )}
      </div>
    </section>
  );
}
