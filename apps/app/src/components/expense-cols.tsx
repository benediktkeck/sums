"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { nextExpenseSort, type ExpenseSort, type ExpenseSortKey } from "@sums/core/model/ops";

const COLUMNS: { key: ExpenseSortKey; label: string; right?: boolean }[] = [
  { key: "name", label: "Was" },
  { key: "provider", label: "Anbieter" },
  { key: "interval", label: "Wie oft" },
  { key: "amount", label: "Betrag", right: true },
  { key: "monthly", label: "Pro Monat", right: true },
];

/** Header of the expense tables; each click cycles a column through both directions and back to manual order. */
export function ExpenseCols({ sort, onSort }: { sort: ExpenseSort | null; onSort: (sort: ExpenseSort | null) => void }) {
  return (
    <div className="cols r-exp">
      <span></span>
      {COLUMNS.map((c) => {
        const dir = sort?.key === c.key ? sort.dir : null;
        const Icon = dir === "asc" ? ArrowUp : ArrowDown;
        return (
          <span key={c.key} className={c.right ? "rt" : ""}>
            <button
              type="button"
              className={`sort-h ${dir ? "a" : ""}`}
              title={nextExpenseSort(sort, c.key) ? `Nach „${c.label}“ sortieren` : "Zurück zur manuellen Reihenfolge"}
              onClick={() => onSort(nextExpenseSort(sort, c.key))}
            >
              {c.label}
              <Icon size={12} strokeWidth={2.6} aria-hidden />
            </button>
          </span>
        );
      })}
      <span></span>
    </div>
  );
}
