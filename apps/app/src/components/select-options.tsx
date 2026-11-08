import { PiggyBank } from "lucide-react";
import type { SelectOption } from "@/components/ui/select";
import { INTERVAL_DIVISOR } from "@sums/core/engine/calculate";
import { INTERVAL_LABEL, INTERVALS } from "@sums/core/model/ops";
import type { Interval, Plan } from "@sums/core/model/schema";
import { initials } from "./summary";

/** Payments per year as a compact tag ("12×", "4×", …) so intervals differ without color. */
export function IntervalTag({ interval }: { interval: Interval }) {
  return (
    <span className="ivt n" data-i={interval}>
      {12 / INTERVAL_DIVISOR[interval]}×
    </span>
  );
}

export const INTERVAL_OPTIONS: SelectOption[] = INTERVALS.map((i) => ({
  value: i,
  label: INTERVAL_LABEL[i],
  icon: <IntervalTag interval={i} />,
  aside:
    i === "monthly" ? undefined : (
      <span className="ivt-sav" title="Wird monatlich in den Rücklagen angespart">
        <PiggyBank size={15} strokeWidth={2.2} />
      </span>
    ),
}));

export function CatDot({ color }: { color: string }) {
  return <span className="cdot" style={{ background: color }} />;
}

export function personOptions(plan: Plan): SelectOption[] {
  return plan.persons.map((p) => ({
    value: p.id,
    label: p.name,
    icon: (
      <span className="av !size-5 !text-[10px]" style={{ background: p.color }}>
        {initials(p.name)}
      </span>
    ),
  }));
}
