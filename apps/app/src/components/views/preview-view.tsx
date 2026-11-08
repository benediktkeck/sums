"use client";

import { useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { formatPercent } from "@sums/core/format";
import { PREVIEW_PAGES, signedEur, type PreviewDoc, type PreviewFooterLine, type PreviewRow, type PreviewSection } from "@/lib/preview";
import { usePlan } from "../plan-provider";
import { Op } from "../ui-bits";

/** Read-only bar of the preview: switch tables or go back to editing. */
export function PreviewBar({ href, onSelect, onExit }: { href: string; onSelect: (href: string) => void; onExit: () => void }) {
  const nav = useRef<HTMLElement>(null);
  // The tabs scroll sideways on phones: keep the current one in view.
  useEffect(() => {
    nav.current?.querySelector(".a")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [href]);
  // ← and → walk through the tabs and wrap around at the ends.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // Alt+← is the browser's back
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const i = PREVIEW_PAGES.findIndex((p) => p.href === href);
      onSelect(PREVIEW_PAGES[(i + dir + PREVIEW_PAGES.length) % PREVIEW_PAGES.length].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, onSelect]);
  return (
    <header className="pv-bar">
      <nav ref={nav} aria-label="Tabellen">
        {PREVIEW_PAGES.map((p) => (
          <button key={p.href} type="button" className={p.href === href ? "a" : ""} aria-current={p.href === href ? "page" : undefined} onClick={() => onSelect(p.href)}>
            {p.label}
          </button>
        ))}
      </nav>
      <span className="sp" />
      <span className="pv-keys hide-m" aria-hidden>
        <kbd>←</kbd>
        <kbd>→</kbd>
      </span>
      <button className="btn ghost" onClick={onExit} title="Zurück zum Bearbeiten (Esc)">
        <Pencil />
        <span className="hide-m">Bearbeiten</span>
      </button>
    </header>
  );
}

/** Same split as the sidebar: where the income goes. */
function Bar({ parts }: { parts: NonNullable<PreviewDoc["bar"]> }) {
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div className="pv-bars">
      <div className="bar" aria-hidden>
        {visible.map((p) => (
          <i key={p.label} style={{ flex: p.value, background: p.color }} />
        ))}
      </div>
      <div className="barl">
        {visible.map((p) => (
          <span key={p.label}>
            <i style={{ background: p.color }} />
            {p.label} <span className="n">{formatPercent(p.value, total)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ row, showDetail, calc, yearly }: { row: PreviewRow; showDetail: boolean; calc: boolean; yearly: boolean }) {
  // On phones the detail moves under the name, except bare yearly amounts: unlabeled there, they only confuse.
  const sub = [row.note, !yearly && row.detail].filter(Boolean).join(" · ");
  return (
    <tr className={row.strong ? "pv-res" : ""}>
      <td className="pv-name">
        {calc && <Op op={row.op} color={row.opColor} />}
        {row.color && <i className="pv-dot" style={{ background: row.color }} />}
        {row.name}
        {row.note && <small className="pv-note">{row.note}</small>}
        {sub && <small className="pv-sub">{sub}</small>}
      </td>
      {showDetail && <td className="pv-detail n">{row.detail}</td>}
      <td className={`pv-val n ${row.reserve ? "text-sav" : ""}`}>{signedEur(row.value)}</td>
    </tr>
  );
}

function Table({ doc, sections, footer, head }: { doc: PreviewDoc; sections: PreviewSection[]; footer: PreviewFooterLine[]; head?: boolean }) {
  const rows = sections.flatMap((s) => s.rows);
  const showDetail = rows.some((r) => r.detail);
  const calc = rows.some((r) => r.op);
  // A cell instead of colSpan: the detail column is hidden on phones and must vanish from every row.
  const detailCell = (detail?: string) => showDetail && <td className="pv-detail n">{detail}</td>;
  return (
    <table className="pv-t">
      {head && (
        <thead>
          <tr>
            <th scope="col">Was</th>
            {showDetail && (
              <th scope="col" className="pv-detail">
                {doc.detailHeader}
              </th>
            )}
            <th scope="col" className="pv-val">
              {doc.valueHeader}
            </th>
          </tr>
        </thead>
      )}
      {sections.map((s) => (
        <tbody key={s.id}>
          {s.name && (
            <tr className="pv-sec">
              <th scope="rowgroup">
                {s.color && <i className="pv-dot" style={{ background: s.color }} />}
                {s.name}
                {s.note && <small className="pv-sec-note n">{s.note}</small>}
              </th>
              {detailCell()}
              <td className="pv-val n">{s.total != null && signedEur(s.total)}</td>
            </tr>
          )}
          {s.rows.map((r) => (
            <Row key={r.id} row={r} showDetail={showDetail} calc={calc} yearly={doc.detailHeader === "Pro Jahr"} />
          ))}
        </tbody>
      ))}
      <tfoot>
        {footer.map((f) => (
          <tr key={f.label}>
            <th scope="row">
              {f.op && <Op op={f.op} color={f.opColor} />}
              {f.label}
            </th>
            {detailCell(f.detail)}
            <td className={`pv-val n ${f.value < 0 ? "text-neg" : ""}`}>{signedEur(f.value)}</td>
          </tr>
        ))}
      </tfoot>
    </table>
  );
}

export function PreviewView({ href }: { href: string }) {
  const { plan, result } = usePlan();
  const page = PREVIEW_PAGES.find((p) => p.href === href)!;
  const doc = page.build(plan, result);
  const empty = doc.sections.every((s) => s.rows.length === 0);
  const scenarios = plan.switches.filter((s) => s.on).map((s) => `„${s.name}“`);
  const note = (doc.hidden > 0 || scenarios.length > 0) && (
    <p className="pv-foot">
      {scenarios.length > 0 && `Mit Szenario ${scenarios.join(", ")}. `}
      {doc.hidden > 0 && `${doc.hidden} ${doc.hidden === 1 ? "ausgeschalteter Eintrag" : "ausgeschaltete Einträge"} nicht angezeigt.`}
    </p>
  );

  return (
    <main className="pv">
      <h1>{doc.title}</h1>
      <p className={`pv-total n ${doc.total < 0 ? "text-neg" : ""}`}>{signedEur(doc.total)}</p>
      <p className="pv-cap n">{doc.caption}</p>

      {empty ? <p className="pv-empty">Noch keine Einträge.</p> : <Table doc={doc} sections={doc.sections} footer={doc.footer} head />}
      {doc.bar && <Bar parts={doc.bar} />}
      {note}
      {doc.after && <Table doc={doc} sections={doc.after.sections} footer={doc.after.footer} />}
    </main>
  );
}
