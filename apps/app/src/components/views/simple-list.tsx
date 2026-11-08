"use client";

import Link from "next/link";
import type { ItemStatus, Override } from "@sums/core/engine/calculate";
import { Checkbox, NumberInput, RowMenu, ScenarioToggle, useDragReorder, ValueCell } from "../ui-bits";

export type SimpleRow = {
  id: string;
  name: string;
  /** Content of the detail column (person, account, calculation basis). */
  detail?: React.ReactNode;
  /** Makes the detail cell a link; by default it opens the edit dialog. */
  detailLink?: { href: string; title: string };
  ownActive: boolean;
  status?: ItemStatus;
  override?: Override;
  /** Editable base amount; omit for computed rows. */
  amount?: number;
  /** What counts (after switches); `raw` is the value if it were active. */
  effective: number;
  raw: number;
};

/** List rows for incomes, variable costs and savings buckets. */
export function SimpleList({
  rows,
  detailHeader,
  onToggle,
  onAmount,
  onEdit,
  onDelete,
  onMove,
  onDuplicate,
}: {
  rows: SimpleRow[];
  detailHeader: string;
  onToggle: (row: SimpleRow) => void;
  onAmount: (row: SimpleRow, value: number, start: number) => void;
  onEdit: (row: SimpleRow) => void;
  onDelete: (row: SimpleRow) => void;
  /** Move `id` before `targetId`, or right after it with `after`. */
  onMove: (id: string, targetId: string, after?: boolean) => void;
  onDuplicate?: (row: SimpleRow) => void;
}) {
  const drag = useDragReorder(onMove);
  return (
    <>
      <div className="cols r-simple">
        <span></span>
        <span>Was</span>
        <span>{detailHeader}</span>
        <span className="rt">Betrag</span>
        <span className="rt">Zählt pro Monat</span>
        <span></span>
      </div>
      {rows.map((row, idx) => {
        const active = row.status?.active ?? row.ownActive;
        const rp = drag.rowProps(row.id);
        return (
          <div key={row.id} {...rp} className={`r r-simple ${active ? "" : "off"} ${row.status?.reason || row.override ? "scen" : ""} ${rp.className}`}>
            {drag.handle(row.id, row.name)}
            {row.status?.reason ? (
              <ScenarioToggle status={row.status} label={row.name} />
            ) : (
              <Checkbox on={active} label={`${row.name} einschalten`} onToggle={() => onToggle(row)} />
            )}
            <button className="nm" onClick={() => onEdit(row)}>
              <span>{row.name || "(ohne Namen)"}</span>
              {row.detail && <small className="pvs m-sub">{row.detail}</small>}
            </button>
            {row.detailLink ? (
              <Link className="pvc" href={row.detailLink.href} title={row.detailLink.title} tabIndex={-1}>
                {row.detail}
              </Link>
            ) : (
              <button className="pvc" onClick={() => onEdit(row)} tabIndex={-1}>
                {row.detail ?? <span className="opacity-40">–</span>}
              </button>
            )}
            <span className="inpc">
              {row.amount != null ? (
                <NumberInput label={`Betrag ${row.name}`} value={row.amount} onChange={(v, s) => onAmount(row, v, s)} />
              ) : (
                <span className="block text-right text-[13px] text-fg-3">berechnet</span>
              )}
            </span>
            <ValueCell value={active ? row.effective : row.raw} active={active} override={row.override} />
            <RowMenu
              label={row.name}
              onEdit={() => onEdit(row)}
              onDuplicate={onDuplicate ? () => onDuplicate(row) : undefined}
              onUp={idx > 0 ? () => onMove(row.id, rows[idx - 1].id) : undefined}
              onDown={idx < rows.length - 1 ? () => onMove(rows[idx + 1].id, row.id) : undefined}
              onDelete={() => onDelete(row)}
            />
          </div>
        );
      })}
    </>
  );
}
